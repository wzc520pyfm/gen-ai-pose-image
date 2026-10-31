import { generateGhostCostume } from "./costume-ghost.mjs"
import { POSE_STYLE_LOCK } from "./custom.mjs"
import { fetchCostumeBytes } from "./costumes.mjs"
import { generateImage } from "./generate.mjs"
import { modelImage } from "./jobs.mjs"
import { fetchPoseBytes } from "./poses.mjs"

/** Fixed catalog files. Standard full-body line art, not a random draw. */
export const POSE_STYLE_PATHS = Object.freeze([
  "img/full_single_P015_front.png",
  "img/full_single_P001_front.png",
])

/** Catalog plates kept for inspection. Custom costume generation does not send them. */
export const COSTUME_STYLE_PATHS = Object.freeze([
  "png/SUM-0174.png",
  "png/AUT-0010.png",
])

export function stylePaths(kind) {
  if (kind === "pose") return POSE_STYLE_PATHS
  if (kind === "costume") return COSTUME_STYLE_PATHS
  throw new Error("需要说明是姿势还是服装")
}

function missingStyleMessage(kind, relativePath, detail) {
  const label = kind === "pose" ? "姿势" : "服装"
  return `${label}风格参考没有读到（${relativePath}）。${detail}。不会改成纯文字生图。`
}

async function readStyleFile(fetchFile, relativePath) {
  try {
    return await fetchFile(relativePath)
  } catch (first) {
    try {
      return await fetchFile(relativePath)
    } catch {
      throw first
    }
  }
}

async function shrinkStyleImage(image) {
  const { default: sharp } = await import("sharp")
  const buffer = await sharp(image.buffer)
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86 })
    .toBuffer()
  if (!buffer || buffer.byteLength < 32) throw new Error("风格参考压缩失败")
  return { mediaType: "image/jpeg", buffer, role: image.role }
}

export async function loadStyleRefs(kind, deps = {}) {
  const paths = stylePaths(kind)
  const fetchPose = deps.fetchPose ?? fetchPoseBytes
  const fetchCostume = deps.fetchCostume ?? fetchCostumeBytes
  const normalize = deps.modelImage ?? modelImage
  const shrink = deps.shrinkStyleImage ?? shrinkStyleImage
  const images = []
  for (const relativePath of paths) {
    try {
      const raw = await readStyleFile(kind === "pose" ? fetchPose : fetchCostume, relativePath)
      const normalized = await normalize(raw)
      const image = await shrink(normalized)
      if (!image?.buffer || image.buffer.byteLength < 32) throw new Error("风格参考是空的")
      images.push({
        mediaType: image.mediaType,
        buffer: image.buffer,
        role: image.role || (kind === "pose" ? "pose" : "costume"),
      })
    } catch (error) {
      const detail = error instanceof Error && !error.message.startsWith("姿势风格参考") && !error.message.startsWith("服装风格参考")
        ? error.message
        : "读取失败"
      throw new Error(missingStyleMessage(kind, relativePath, detail))
    }
  }
  if (images.length !== paths.length) {
    throw new Error(kind === "pose" ? "姿势风格参考没有凑齐，不会改成纯文字生图。" : "服装风格参考没有凑齐，不会改成纯文字生图。")
  }
  return images
}

function withStyleLock(prompt, lock) {
  const text = String(prompt || "").trim()
  if (!text) throw new Error("先写好提示词")
  if (text.includes(lock)) return text.slice(0, 4000)
  const room = Math.max(0, 4000 - lock.length - 1)
  return `${text.slice(0, room)}\n${lock}`
}

function referenceResult(image) {
  return {
    mediaType: image.mediaType,
    buffer: image.buffer,
    referencesSent: image.referencesSent,
    warning: typeof image.warning === "string" ? image.warning : "",
  }
}

export async function generateStyledReference(input = {}) {
  const kind = input.kind === "pose" || input.kind === "costume" ? input.kind : ""
  if (!kind) throw new Error("需要说明是姿势还是服装")
  if (kind === "costume") {
    const run = input.generateGhostCostume ?? generateGhostCostume
    return referenceResult(await run(input))
  }
  const images = await loadStyleRefs(kind, input)
  const generate = input.generate ?? generateImage
  return referenceResult(await generate({
    provider: input.provider,
    apiKey: input.apiKey,
    baseURL: input.baseURL ?? "",
    model: input.model,
    prompt: withStyleLock(input.prompt, POSE_STYLE_LOCK),
    images,
    aspectRatio: input.aspectRatio,
    signal: input.signal,
    allowReferenceFallback: false,
  }))
}
