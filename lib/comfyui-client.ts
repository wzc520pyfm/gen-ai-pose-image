import { dimensions, localPrompts, type ComfyPose } from "@/shared/comfyui.mjs"
import { connectionURL, createSheetCache, generateComfyTask } from "@/shared/comfyui-client.mjs"
import { getBuiltinModel } from "@/shared/builtin-models.mjs"
import { base64ToBlob, blobToBase64, type CustomWire } from "@/lib/library"
import type { StudioSettings } from "@/lib/settings"
import type { AspectRatio, CharacterImageInput, GeneratedResult, GenerateMode } from "@/lib/types"

export type ComfyItem = { viewId: string; title: string; pose: ComfyPose | null }
type Costume = { id: string; label: string; keywords: string } | null
type Face = { id: string; section: string; hair: string; label: string; keywords: string } | null
type PromptInput = { items: ComfyItem[]; costume: Costume; face?: Face; extraPrompt: string; keepOutfit: boolean; characterCount: number; mode: GenerateMode }

export function comfyPromptCards(input: PromptInput) {
  const cards = input.items.map((item) => {
    const prompts = localPrompts({ ...input, pose: item.pose })
    return { viewId: item.viewId, title: item.title, prompt: item.pose ? `${prompts.scaffold}\n\n${prompts.final}` : prompts.outfit }
  })
  return input.mode === "sheet" ? [{ viewId: cards.map((c) => c.viewId).join(","), title: "姿势拼图", prompt: cards.map((c, i) => `${i + 1}. ${c.prompt}`).join("\n\n") }] : cards
}

async function imageFromBlob(blob: Blob) {
  const image = await createImageBitmap(blob)
  if (image.width * image.height > 40000000) { image.close(); throw new Error("图片尺寸过大，请缩小后重试。") }
  return image
}

function png(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("浏览器图片处理失败。")), "image/png"))
}

function canvasFor(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("浏览器无法创建图片画布。")
  return { canvas, context }
}

export async function prepareComfyImage(blob: Blob, aspectRatio?: AspectRatio) {
  const image = await imageFromBlob(blob)
  try {
    const [width, height] = aspectRatio ? dimensions(aspectRatio) : [image.width, image.height]
    const { canvas, context } = canvasFor(width, height)
    context.fillStyle = aspectRatio ? "#eeeeee" : "white"
    context.fillRect(0, 0, width, height)
    const scale = Math.min(width / image.width, height / image.height)
    const w = image.width * scale, h = image.height * scale
    context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h)
    return await png(canvas)
  } finally { image.close() }
}

export async function composeComfySheet(images: Blob[], aspectRatio: AspectRatio) {
  if (!images.length || images.length > 4) throw new Error("拼图需要 1 到 4 张图片。")
  if (images.length === 1) return images[0]
  const [baseWidth, baseHeight] = dimensions(aspectRatio)
  const width = baseWidth * 2, height = baseHeight * 2, gap = 16
  const { canvas, context } = canvasFor(width, height)
  context.fillStyle = "white"
  context.fillRect(0, 0, width, height)
  const rows = images.length <= 2 ? 1 : 2
  const cellWidth = Math.floor((width - gap * 3) / 2), cellHeight = Math.floor((height - gap * (rows + 1)) / rows)
  for (const [i, blob] of images.entries()) {
    const image = await imageFromBlob(blob)
    try {
      const scale = Math.min(cellWidth / image.width, cellHeight / image.height)
      const w = image.width * scale, h = image.height * scale
      context.drawImage(image, gap + (i % 2) * (cellWidth + gap) + (cellWidth - w) / 2, gap + Math.floor(i / 2) * (cellHeight + gap) + (cellHeight - h) / 2, w, h)
    } finally { image.close() }
  }
  return png(canvas)
}

const sheetCache = createSheetCache()
type GenerateInput = Omit<PromptInput, "characterCount"> & {
  aspectRatio: AspectRatio
  characterImages: CharacterImageInput[]
  builtinModelId: string
  customReferences: { poses: CustomWire[]; costumes: CustomWire[] }
  localRunId?: string
}

export async function requestComfyGenerate(basePath: string, settings: StudioSettings, input: GenerateInput, signal: AbortSignal): Promise<GeneratedResult[]> {
  const url = connectionURL(settings.comfyuiURL)
  if (!input.items.length || input.items.length > (input.mode === "sheet" ? 4 : 8)) throw new Error("请选择有效数量的姿势或服装。")
  if (input.characterImages.length > 4) throw new Error("模特参考图最多 4 张。")
  const publicImage = async (path: string) => {
    const response = await fetch(`${basePath.replace(/\/$/, "")}${path}`, { signal })
    if (!response.ok) throw new Error("公共参考图加载失败，请重试。")
    return response.blob()
  }
  const wireImage = (image: CharacterImageInput) => {
    if (!image.dataBase64) throw new Error("参考图为空，请重新导入。")
    return base64ToBlob(image.dataBase64, image.mediaType)
  }
  signal.throwIfAborted()
  const sources = input.characterImages.length ? input.characterImages.map(wireImage) : [await publicImage(getBuiltinModel(input.builtinModelId)?.sheet || "/muse/dafeiyu-sheet.png")]
  const characters = await Promise.all(sources.map((blob) => prepareComfyImage(blob, input.aspectRatio)))
  const customGarment = input.customReferences.costumes.find((c) => c.id === input.costume?.id)
  const garment = input.costume ? await prepareComfyImage(customGarment ? wireImage(customGarment) : await publicImage(`/api/costume-image?id=${encodeURIComponent(input.costume.id)}&size=preview`)) : undefined
  const faceImage = input.face ? await prepareComfyImage(await publicImage(`/api/face-image?id=${encodeURIComponent(input.face.id)}&size=full`)) : undefined
  const key = input.mode === "sheet" && input.localRunId ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ input, url, token: settings.comfyuiToken }))))).map((n) => n.toString(16).padStart(2, "0")).join("") : ""
  const cells = key ? sheetCache.cells(key) : new Map<string, Blob>()
  const cards = comfyPromptCards({ ...input, mode: "each", characterCount: characters.length })
  const results: GeneratedResult[] = []
  const images: Blob[] = []
  for (const [index, item] of input.items.entries()) {
    signal.throwIfAborted()
    const card = cards[index]
    try {
      let image = cells.get(item.viewId)
      if (!image) {
        const customPose = input.customReferences.poses.find((p) => p.id === item.viewId)
        const poseImage = item.pose ? await prepareComfyImage(customPose ? wireImage(customPose) : await publicImage(`/api/pose-image?id=${encodeURIComponent(item.viewId)}&size=full`)) : undefined
        image = await prepareComfyImage(await generateComfyTask({ url, token: settings.comfyuiToken, characters, garment, poseImage, faceImage, face: input.face, pose: item.pose, costume: input.costume, aspectRatio: input.aspectRatio, extraPrompt: input.extraPrompt, keepOutfit: input.keepOutfit, signal }))
        cells.set(item.viewId, image)
      }
      images.push(image)
      results.push({ ...card, ok: true, mediaType: "image/png", imageBase64: await blobToBase64(image), referencesSent: true })
    } catch (error) {
      signal.throwIfAborted()
      results.push({ ...card, ok: false, error: error instanceof Error ? error.message : "ComfyUI 生图失败" })
    }
  }
  if (input.mode === "sheet" && results.every((r) => r.ok)) {
    const sheet = await composeComfySheet(images, input.aspectRatio)
    if (key) sheetCache.delete(key)
    return [{ ...comfyPromptCards({ ...input, characterCount: characters.length })[0], ok: true, mediaType: "image/png", imageBase64: await blobToBase64(sheet), referencesSent: true }]
  }
  return results
}
