import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { characterFromUploads, DEFAULT_CHARACTER } from "./character.mjs"
import { resolveView } from "./catalog.mjs"
import { costumeFile, fetchCostumeBytes, getCostume } from "./costumes.mjs"
import { assertBaseURL, defaultModel, generateImage } from "./generate.mjs"
import { fetchPoseBytes } from "./poses.mjs"
import { composePrompt } from "./prompt.mjs"

export { fetchPoseBytes, isSafePosePath, poseFileFor } from "./poses.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_CHARACTER_FILE = join(ROOT, "public/muse/dafeiyu-sheet.png")
const ASPECTS = new Set(["1:1", "3:4", "4:3", "9:16", "16:9"])

async function ffmpegWebpToJpeg(buffer) {
  const dir = await mkdtemp(join(tmpdir(), "pose-muse-"))
  try {
    const source = join(dir, "in.webp")
    const dest = join(dir, "out.jpg")
    await writeFile(source, buffer)
    await new Promise((resolve, reject) => {
      const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", source, "-q:v", "4", dest])
      let message = ""
      child.stderr?.on("data", (chunk) => { message += chunk })
      child.on("error", reject)
      child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(message.trim() || "服装图转成 JPEG 失败"))))
    })
    return await readFile(dest)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function webpToJpeg(buffer) {
  try {
    const { default: sharp } = await import("sharp")
    return await sharp(buffer).jpeg({ quality: 90 }).toBuffer()
  } catch (sharpError) {
    try {
      return await ffmpegWebpToJpeg(buffer)
    } catch {
      const message = sharpError instanceof Error ? sharpError.message : "服装图转成 JPEG 失败"
      throw new Error(message)
    }
  }
}

export async function modelImage(image) {
  if (image.mediaType === "image/png" || image.mediaType === "image/jpeg") return image
  if (image.mediaType !== "image/webp") throw new Error("参考图格式不支持")
  return { mediaType: "image/jpeg", buffer: await webpToJpeg(image.buffer), role: image.role }
}

export async function loadDefaultCharacterImage() {
  const buffer = await readFile(DEFAULT_CHARACTER_FILE)
  return { mediaType: "image/png", buffer, role: "character" }
}

function mediaTypeOf(buffer, declared) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png"
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg"
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp"
  if (declared === "image/png" || declared === "image/jpeg" || declared === "image/webp") return declared
  throw new Error("模特图片只支持 PNG、JPEG、WebP")
}

export function decodeCharacterImage(input) {
  const declared = typeof input?.mediaType === "string" ? input.mediaType : ""
  const data = typeof input?.dataBase64 === "string" ? input.dataBase64.replace(/\s/g, "") : ""
  if (!data) throw new Error("模特图片是空的")
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error("模特图片数据无效")
  const buffer = Buffer.from(data, "base64")
  if (buffer.byteLength < 32 || buffer.byteLength > 5_000_000) throw new Error("单张模特图片需小于 5MB")
  return { mediaType: mediaTypeOf(buffer, declared), buffer, role: "character" }
}

export function planRequest(input = {}) {
  const provider = input.provider === "openai" || input.provider === "gemini" || input.provider === "seedream" ? input.provider : null
  if (!provider) throw new Error("不支持的生图接口")
  const mode = input.mode === "sheet" ? "sheet" : "each"
  const rawIds = Array.isArray(input.viewIds) ? input.viewIds : []
  const viewIds = [...new Set(rawIds.filter((id) => typeof id === "string" && id.trim()))]
  const max = mode === "sheet" ? 4 : 8
  if (viewIds.length === 0) throw new Error("先选择至少一个姿势")
  if (viewIds.length > max) throw new Error(mode === "sheet" ? "拼图一次最多 4 个姿势" : "一次最多 8 个姿势")
  const items = viewIds.map((id) => {
    const found = resolveView(id.trim())
    if (!found) throw new Error(`找不到姿势 ${id}`)
    return {
      viewId: found.view.id,
      poseId: found.pose.id,
      title: `${found.pose.name} · ${found.view.angle}`,
      posePath: found.view.full,
      pose: {
        name: found.pose.name,
        category: found.pose.category,
        system: found.pose.system,
        angle: found.view.angle,
        people: found.pose.people,
      },
    }
  })
  const uploads = Array.isArray(input.characterImages) ? input.characterImages : []
  const declaredCount = Number(input.characterCount) || 0
  const characterCount = uploads.length || declaredCount
  if (characterCount > 3) throw new Error("模特参考图最多 3 张")
  const character = characterCount > 0 ? characterFromUploads(characterCount) : DEFAULT_CHARACTER
  const costumeId = typeof input.costumeId === "string" ? input.costumeId.trim() : ""
  const costume = costumeId ? getCostume(costumeId) : null
  if (costumeId && !costume) throw new Error(`找不到服装 ${costumeId}`)
  const keepOutfit = costume ? false : input.keepOutfit !== false
  const extraPrompt = typeof input.extraPrompt === "string" ? input.extraPrompt.replace(/[^\S\n]+/g, " ").trim().slice(0, 2000) : ""
  const aspectRatio = ASPECTS.has(input.aspectRatio) ? input.aspectRatio : "3:4"
  const costumePrompt = costume ? { id: costume.id, keywords: costume.keywords } : null
  const sheetPrompt = composePrompt({ character, poses: items.map((item) => item.pose), extraPrompt, keepOutfit, mode: "sheet", costume: costumePrompt })
  for (const item of items) {
    item.prompt = mode === "sheet"
      ? sheetPrompt
      : composePrompt({ character, poses: [item.pose], extraPrompt, keepOutfit, mode: "each", costume: costumePrompt })
  }
  const modelText = typeof input.model === "string" ? input.model.trim() : ""
  if (modelText.length > 120) throw new Error("模型名过长")
  return {
    provider,
    apiKey: typeof input.apiKey === "string" ? input.apiKey.trim() : "",
    baseURL: assertBaseURL(input.baseURL),
    model: modelText || defaultModel(provider),
    aspectRatio,
    mode,
    character,
    costume,
    items,
    uploads,
    sheetPrompt,
  }
}

export function promptCards(plan) {
  if (plan.mode === "sheet") {
    return [{
      viewId: plan.items.map((item) => item.viewId).join(","),
      title: plan.items.map((item) => item.title).join(" / "),
      prompt: plan.sheetPrompt,
    }]
  }
  return plan.items.map((item) => ({ viewId: item.viewId, title: item.title, prompt: item.prompt }))
}

export async function resolveCharacterImages(plan) {
  if (plan.uploads.length === 0) return [await loadDefaultCharacterImage()]
  return plan.uploads.map(decodeCharacterImage)
}

export async function runGeneration(input, deps = {}) {
  const plan = planRequest(input)
  if (!plan.apiKey) throw new Error("还没有填写 API Key。可以先在右侧看提示词，或到设置里填入 Seedream、Gemini 或 OpenAI 兼容接口的密钥。")
  const fetchPose = deps.fetchPose ?? fetchPoseBytes
  const generate = deps.generate ?? generateImage
  const characterImages = await resolveCharacterImages(plan)
  const fetchCostume = deps.fetchCostume ?? fetchCostumeBytes
  const costumeImages = plan.costume ? [await modelImage(await fetchCostume(costumeFile(plan.costume, "preview")))] : []
  const signal = deps.signal
  if (plan.mode === "sheet") {
    const poseImages = []
    for (const item of plan.items) poseImages.push(await fetchPose(item.posePath))
    const image = await generate({
      provider: plan.provider,
      apiKey: plan.apiKey,
      baseURL: plan.baseURL,
      model: plan.model,
      prompt: plan.sheetPrompt,
      images: [...characterImages, ...costumeImages, ...poseImages],
      aspectRatio: plan.aspectRatio,
      signal,
    })
    return {
      results: [{
        viewId: plan.items.map((item) => item.viewId).join(","),
        title: plan.items.map((item) => item.title).join(" / "),
        prompt: plan.sheetPrompt,
        ok: true,
        mediaType: image.mediaType,
        imageBase64: image.buffer.toString("base64"),
        referencesSent: image.referencesSent,
        warning: image.warning,
      }],
    }
  }
  const results = []
  for (const item of plan.items) {
    if (signal?.aborted) break
    try {
      const poseImage = await fetchPose(item.posePath)
      const image = await generate({
        provider: plan.provider,
        apiKey: plan.apiKey,
        baseURL: plan.baseURL,
        model: plan.model,
        prompt: item.prompt,
        images: [...characterImages, ...costumeImages, poseImage],
        aspectRatio: plan.aspectRatio,
        signal,
      })
      results.push({
        viewId: item.viewId,
        title: item.title,
        prompt: item.prompt,
        ok: true,
        mediaType: image.mediaType,
        imageBase64: image.buffer.toString("base64"),
        referencesSent: image.referencesSent,
        warning: image.warning,
      })
    } catch (error) {
      results.push({
        viewId: item.viewId,
        title: item.title,
        prompt: item.prompt,
        ok: false,
        error: error instanceof Error ? error.message : "生图失败",
      })
    }
  }
  return { results }
}
