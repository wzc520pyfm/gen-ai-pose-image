import { composeLocalSheet, generateLocal, localPrompts, comfyURL } from "./comfyui.mjs"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { getBuiltinModel } from "./builtin-models.mjs"
import { characterForBuiltin, characterFromUploads } from "./character.mjs"
import { IDENTITY_REQUIRED, NO_MODEL_ID } from "./models.mjs"
import { resolveView } from "./catalog.mjs"
import { isCustomCostumeId, isCustomPoseId, missingCustomCostumeMessage, missingCustomPoseMessage } from "./custom.mjs"
import { costumeFile, fetchCostumeBytes, getCostume } from "./costumes.mjs"
import { faceFile, fetchFaceBytes, getFace } from "./faces.mjs"
import { assertBaseURL, defaultModel, generateImage } from "./generate.mjs"
import { fetchPoseBytes } from "./poses.mjs"
import { composePrompt } from "./prompt.mjs"
import { getCustomCostumeAsset, getCustomPoseAsset } from "./registry.mjs"

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

export function builtinSheetFile(id) {
  const model = getBuiltinModel(id) || getBuiltinModel("dafeiyu")
  const name = String(model?.sheet || "").replace(/^\/muse\//, "")
  if (!/^[\w.-]+$/.test(name)) throw new Error("内置模特设定图路径无效")
  return join(ROOT, "public", "muse", name)
}

export async function loadDefaultCharacterImage(id = "dafeiyu") {
  const buffer = await readFile(id ? builtinSheetFile(id) : DEFAULT_CHARACTER_FILE)
  return { mediaType: "image/png", buffer, role: "character" }
}

function mediaTypeOf(buffer, declared) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png"
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg"
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp"
  if (declared === "image/png" || declared === "image/jpeg" || declared === "image/webp") return declared
  throw new Error("图片只支持 PNG、JPEG、WebP")
}

export function decodeCharacterImage(input) {
  return decodeImage(input, "character", "模特图片", 5_000_000)
}

export function decodeReferenceImage(input, role) {
  return decodeImage(input, role, "参考图", 8_000_000)
}

function decodeImage(input, role, label, maxBytes) {
  const declared = typeof input?.mediaType === "string" ? input.mediaType : ""
  const data = typeof input?.dataBase64 === "string" ? input.dataBase64.replace(/\s/g, "") : ""
  if (!data) throw new Error(`${label}是空的`)
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error(`${label}数据无效`)
  const buffer = Buffer.from(data, "base64")
  if (buffer.byteLength < 32 || buffer.byteLength > maxBytes) throw new Error(`${label}需小于 ${Math.round(maxBytes / 1_000_000)}MB`)
  return { mediaType: mediaTypeOf(buffer, declared), buffer, role }
}

function listedReference(list, id) {
  if (!Array.isArray(list)) return undefined
  return list.find((item) => item && item.id === id)
}

function customPoseAsset(id, input) {
  const inline = listedReference(input.customReferences?.poses, id)
  if (inline?.dataBase64) return inline
  const stored = getCustomPoseAsset(id)
  if (stored?.dataBase64) return stored
  return inline || stored
}

function customCostumeAsset(id, input) {
  const inline = listedReference(input.customReferences?.costumes, id)
  if (inline?.dataBase64) return inline
  const stored = getCustomCostumeAsset(id)
  if (stored?.dataBase64) return stored
  return inline || stored
}

function planPose(id, input) {
  const trimmed = id.trim()
  if (isCustomPoseId(trimmed)) {
    const asset = customPoseAsset(trimmed, input)
    if (!asset?.dataBase64) throw new Error(missingCustomPoseMessage(trimmed))
    const label = String(asset.label || asset.name || "自定义姿势").slice(0, 80)
    return {
      viewId: trimmed,
      poseId: trimmed,
      title: `${label} · 自定义`,
      source: "custom",
      poseImage: { mediaType: asset.mediaType || "image/png", dataBase64: asset.dataBase64 },
      pose: { name: label, category: "自定义", system: "自定义", angle: "自定义", people: 1 },
    }
  }
  const found = resolveView(trimmed)
  if (!found) throw new Error(`找不到姿势 ${id}`)
  return {
    viewId: found.view.id,
    poseId: found.pose.id,
    title: `${found.pose.name} · ${found.view.angle}`,
    source: "catalog",
    posePath: found.view.full,
    pose: {
      name: found.pose.name,
      category: found.pose.category,
      system: found.pose.system,
      angle: found.view.angle,
      people: found.pose.people,
    },
  }
}

function planCostume(costumeId, input) {
  if (!costumeId) return null
  if (isCustomCostumeId(costumeId)) {
    const asset = customCostumeAsset(costumeId, input)
    if (!asset?.dataBase64) throw new Error(missingCustomCostumeMessage(costumeId))
    return {
      id: asset.id,
      keywords: String(asset.keywords || asset.label || "自定义服装"),
      source: "custom",
      image: { mediaType: asset.mediaType || "image/png", dataBase64: asset.dataBase64 },
    }
  }
  const costume = getCostume(costumeId)
  if (!costume) throw new Error(`找不到服装 ${costumeId}`)
  return costume
}

async function poseReference(item, fetchPose) {
  if (item.source === "custom") return modelImage(decodeReferenceImage(item.poseImage, "pose"))
  return fetchPose(item.posePath)
}

async function costumeReferences(plan, fetchCostume) {
  if (!plan.costume) return []
  if (plan.costume.source === "custom") return [await modelImage(decodeReferenceImage(plan.costume.image, "costume"))]
  return [await modelImage(await fetchCostume(costumeFile(plan.costume, "preview")))]
}

function planFace(faceId) {
  if (!faceId) return null
  const face = getFace(faceId)
  if (!face) throw new Error(`找不到脸部参考 ${faceId}`)
  return face
}

async function faceReferences(plan, fetchFace) {
  if (!plan.face) return []
  return [await compressFaceReference(await modelImage(await fetchFace(faceFile(plan.face, "full"))))]
}

/** Face originals are ~2MB PNGs. JPEG at the same pixel size uploads faster and gives Seedream less to decode. */
export async function compressFaceReference(image) {
  const { default: sharp } = await import("sharp")
  const buffer = await sharp(image.buffer, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer()
  if (!buffer || buffer.byteLength < 32) throw new Error("脸部图压缩失败")
  return { mediaType: "image/jpeg", buffer, role: "face" }
}

export function referenceImages({ characterImages, faceImages = [], costumeImages = [], poseImages = [] }) {
  return [...characterImages, ...faceImages, ...costumeImages, ...poseImages]
}

export function planRequest(input = {}) {
  const provider = input.provider === "openai" || input.provider === "gemini" || input.provider === "seedream" ? input.provider : null
  if (!provider) throw new Error("不支持的生图接口")
  const mode = input.mode === "sheet" ? "sheet" : "each"
  const rawIds = Array.isArray(input.viewIds) ? input.viewIds : []
  const viewIds = [...new Set(rawIds.filter((id) => typeof id === "string" && id.trim()))]
  const max = mode === "sheet" ? 4 : 8
  if (viewIds.length === 0 && !(input.engine === "comfyui" && input.costumeId)) throw new Error("先选择至少一个姿势或在本地模式选择服装")
  if (viewIds.length > max) throw new Error(mode === "sheet" ? "拼图一次最多 4 个姿势" : "一次最多 8 个姿势")
  const items = viewIds.map((id) => planPose(id, input))
  const uploads = Array.isArray(input.characterImages) ? input.characterImages : []
  const declaredCount = Number(input.characterCount) || 0
  const characterCount = uploads.length || declaredCount
  if (characterCount > 4) throw new Error("模特参考图最多 4 张")
  const costumeId = typeof input.costumeId === "string" ? input.costumeId.trim() : ""
  const costume = planCostume(costumeId, input)
  const faceId = typeof input.faceId === "string" ? input.faceId.trim() : ""
  const face = planFace(faceId)
  const requestedBuiltin = typeof input.builtinModelId === "string" ? input.builtinModelId.trim() : ""
  const omitModel = requestedBuiltin === NO_MODEL_ID
  let builtinModelId = ""
  let character = null
  let identityCount = 1
  if (uploads.length > 0 || (declaredCount > 0 && !omitModel)) {
    identityCount = uploads.length || declaredCount
    character = characterFromUploads(identityCount)
  } else if (omitModel) {
    if (!face) throw new Error(IDENTITY_REQUIRED)
    identityCount = 0
    character = null
  } else {
    builtinModelId = getBuiltinModel(requestedBuiltin)?.id || "dafeiyu"
    character = characterForBuiltin(builtinModelId)
    identityCount = 1
  }
  if (input.engine === "comfyui" && items.length === 0) items.push({ viewId: "outfit", title: "仅换装", pose: null })
  const keepOutfit = costume ? false : input.keepOutfit !== false
  const extraPrompt = typeof input.extraPrompt === "string" ? input.extraPrompt.replace(/[^\S\n]+/g, " ").trim().slice(0, 2000) : ""
  const aspectRatio = ASPECTS.has(input.aspectRatio) ? input.aspectRatio : "3:4"
  const costumePrompt = costume ? { id: costume.id, keywords: costume.keywords } : null
  const facePrompt = face ? { id: face.id, section: face.section, hair: face.hair, label: face.label, keywords: face.keywords } : null
  const promptInput = { character, extraPrompt, keepOutfit, costume: costumePrompt, face: facePrompt, characterCount: identityCount }
  let sheetPrompt = composePrompt({ ...promptInput, poses: items.map((item) => item.pose).filter(Boolean), mode: "sheet" })
  for (const item of items) {
    item.prompt = mode === "sheet"
      ? sheetPrompt
      : composePrompt({ ...promptInput, poses: [item.pose].filter(Boolean), mode: "each" })
  }
  if (input.engine === "comfyui") {
    for (const item of items) {
      const p = localPrompts({ pose: item.pose, costume, face: facePrompt, extraPrompt, characterCount: identityCount, keepOutfit })
      item.prompt = item.pose ? p.scaffold + "\n\n" + p.final : p.outfit
    }
    sheetPrompt = items.map((item, index) => `${index + 1}. ${item.prompt}`).join("\n\n")
  }
  const modelText = typeof input.model === "string" ? input.model.trim() : ""
  if (modelText.length > 120) throw new Error("模型名过长")
  return {
    engine: input.engine === "comfyui" ? "comfyui" : "cloud",
    localRunId: typeof input.localRunId === "string" && /^[\w-]{1,64}$/.test(input.localRunId) ? input.localRunId : "",
    provider,
    apiKey: typeof input.apiKey === "string" ? input.apiKey.trim() : "",
    baseURL: assertBaseURL(input.baseURL),
    model: modelText || defaultModel(provider),
    aspectRatio,
    mode,
    character,
    builtinModelId,
    costume,
    face,
    items,
    uploads,
    extraPrompt,
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
  if (!plan.character) return []
  if (plan.uploads.length === 0) return [await loadDefaultCharacterImage(plan.builtinModelId)]
  return plan.uploads.map(decodeCharacterImage)
}

export async function runGeneration(input, deps = {}) {
  const plan = planRequest(input)
  if (plan.engine === "comfyui") return runLocalGeneration(plan, deps)
  if (!plan.apiKey) throw new Error("还没有填写 API Key。可以先在右侧看提示词，或到设置里填入 Seedream、Gemini 或 OpenAI 兼容接口的密钥。")
  const signal = deps.signal
  const fetchPose = deps.fetchPose ?? fetchPoseBytes
  const generate = deps.generate ?? generateImage
  const characterImages = await resolveCharacterImages(plan)
  const fetchCostume = deps.fetchCostume ?? fetchCostumeBytes
  const fetchFace = deps.fetchFace ?? ((path) => fetchFaceBytes(path, fetch, signal))
  const costumeImages = await costumeReferences(plan, fetchCostume)
  const faceImages = await faceReferences(plan, fetchFace)
  if (plan.mode === "sheet") {
    const poseImages = []
    for (const item of plan.items) poseImages.push(await poseReference(item, fetchPose))
    const image = await generate({
      provider: plan.provider,
      apiKey: plan.apiKey,
      baseURL: plan.baseURL,
      model: plan.model,
      prompt: plan.sheetPrompt,
      images: referenceImages({ characterImages, faceImages, costumeImages, poseImages }),
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
      const poseImage = await poseReference(item, fetchPose)
      const image = await generate({
        provider: plan.provider,
        apiKey: plan.apiKey,
        baseURL: plan.baseURL,
        model: plan.model,
        prompt: item.prompt,
        images: referenceImages({ characterImages, faceImages, costumeImages, poseImages: [poseImage] }),
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


const sheetCache = new Map()

async function runLocalGeneration(plan, deps) {
  comfyURL()
  // Short-lived, bounded, in-memory cells let a failed sheet retry only missing poses.
  const key = plan.mode === "sheet" && plan.localRunId ? createHash("sha256").update(JSON.stringify(plan)).digest("hex") : ""
  for (const [id, entry] of sheetCache) if (Date.now() - entry.created > 600000) sheetCache.delete(id)
  if (key && !sheetCache.has(key)) {
    if (sheetCache.size >= 4) sheetCache.delete(sheetCache.keys().next().value)
    sheetCache.set(key, { created: Date.now(), cells: new Map() })
  }
  const cached = sheetCache.get(key)?.cells
  const characters = await resolveCharacterImages(plan)
  const garments = await costumeReferences(plan, deps.fetchCostume ?? fetchCostumeBytes)
  const faces = await faceReferences(plan, deps.fetchFace ?? ((path) => fetchFaceBytes(path, fetch, deps.signal)))
  const generate = deps.generateLocal ?? generateLocal
  const results = []
  const images = []
  for (const item of plan.items) {
    deps.signal?.throwIfAborted()
    try {
      const poseImage = item.pose ? await poseReference(item, deps.fetchPose ?? fetchPoseBytes) : undefined
      const image = cached?.get(item.viewId) ?? await generate({ characters, garment: garments[0], poseImage, faceImage: faces[0], pose: item.pose, costume: plan.costume, face: plan.face, aspectRatio: plan.aspectRatio, extraPrompt: plan.extraPrompt, keepOutfit: plan.keepOutfit, signal: deps.signal })
      cached?.set(item.viewId, image)
      images.push(image)
      results.push({ viewId: item.viewId, title: item.title, prompt: item.prompt, ok: true, mediaType: image.mediaType, imageBase64: image.buffer.toString("base64"), referencesSent: true })
    } catch (error) {
      deps.signal?.throwIfAborted()
      results.push({ viewId: item.viewId, title: item.title, prompt: item.prompt, ok: false, error: error instanceof Error ? error.message : "本地生图失败" })
    }
  }
  if (plan.mode === "sheet" && results.every((r) => r.ok)) {
    const sheet = await composeLocalSheet(images, plan.aspectRatio)
    sheetCache.delete(key)
    return { results: [{ viewId: plan.items.map((i) => i.viewId).join(","), title: "姿势拼图", prompt: plan.sheetPrompt, ok: true, mediaType: sheet.mediaType, imageBase64: sheet.buffer.toString("base64"), referencesSent: true }] }
  }
  return { results }
}
