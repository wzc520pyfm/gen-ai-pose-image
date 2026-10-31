import { defaultModel, decomposeSeedreamImage, generateImage } from "./generate.mjs"
import {
  costumeLayerPrompt,
  costumeRemovalPrompt,
  ensureWearPrompt,
  selectGhostLayers,
  supportsCostumeLayerSplit,
} from "./costume-prompt.mjs"

export {
  classifyCostumeLayer,
  costumeBeautifyRole,
  costumeLayerPrompt,
  costumeRemovalPrompt,
  costumeWearPrompt,
  ensureWearPrompt,
  selectGhostLayers,
  stripGhostClauses,
  supportsCostumeLayerSplit,
  WEAR_MARKER,
} from "./costume-prompt.mjs"

function studioError(error) {
  const text = brief(error)
  if (/超时|API Key|密钥|没有填写/.test(text)) return text
  return "服装参考没有生成。请再试一次。"
}

export async function prepareCostumeLayerImage(image) {
  const { default: sharp } = await import("sharp")
  const buffer = await sharp(image.buffer).rotate().jpeg({ quality: 90 }).toBuffer()
  const meta = await sharp(buffer).metadata()
  const width = meta.width || 0
  const height = meta.height || 0
  if (width < 512 || height < 512) throw new Error("穿着图小于 512 像素，没法拆图层。")
  if (width * height > 36_000_000) throw new Error("穿着图太大，没法拆图层。")
  return { mediaType: "image/jpeg", buffer }
}

function box4(value) {
  if (!Array.isArray(value) || value.length < 4) return null
  const nums = value.slice(0, 4).map(Number)
  if (nums.some((item) => !Number.isFinite(item))) return null
  return nums
}

function resolveBox(layer, width, height) {
  const absolute = box4(layer.absolute)
  if (absolute) return absolute.map((item) => Math.round(item))
  const normalized = box4(layer.normalized)
  if (!normalized) return null
  return [
    Math.round(normalized[0] / 1000 * width),
    Math.round(normalized[1] / 1000 * height),
    Math.round(normalized[2] / 1000 * width),
    Math.round(normalized[3] / 1000 * height),
  ]
}

function placedBox(layer, width, height) {
  const box = resolveBox(layer, width, height)
  if (!box) return null
  const left = Math.max(0, Math.min(width - 1, box[0]))
  const top = Math.max(0, Math.min(height - 1, box[1]))
  const right = Math.max(left + 1, Math.min(width, box[2]))
  const bottom = Math.max(top + 1, Math.min(height, box[3]))
  return { left, top, width: right - left, height: bottom - top }
}

async function cornerColor(buffer) {
  const { default: sharp } = await import("sharp")
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const points = [
    [1, 1],
    [info.width - 2, 1],
    [1, info.height - 2],
    [info.width - 2, info.height - 2],
  ]
  let red = 0
  let green = 0
  let blue = 0
  let count = 0
  for (const [x, y] of points) {
    if (x < 0 || y < 0 || x >= info.width || y >= info.height) continue
    const index = (y * info.width + x) * info.channels
    red += data[index]
    green += data[index + 1]
    blue += data[index + 2]
    count += 1
  }
  if (!count) return { r: 200, g: 200, b: 200 }
  return { r: Math.round(red / count), g: Math.round(green / count), b: Math.round(blue / count) }
}

export async function compositeGhostLayers(baseBuffer, layers, eraseLayers = []) {
  const { default: sharp } = await import("sharp")
  const baseMeta = await sharp(baseBuffer).metadata()
  const width = baseMeta.width || 0
  const height = baseMeta.height || 0
  if (width < 2 || height < 2) throw new Error("底图尺寸无效")
  const background = await cornerColor(baseBuffer)
  const overlays = []
  for (const layer of Array.isArray(eraseLayers) ? eraseLayers : []) {
    const box = placedBox(layer, width, height)
    if (!box) continue
    const input = await sharp({
      create: { width: box.width, height: box.height, channels: 4, background: { ...background, alpha: 1 } },
    }).png().toBuffer()
    overlays.push({ input, left: box.left, top: box.top })
  }
  const erased = overlays.length
  const ordered = [...(Array.isArray(layers) ? layers : [])].sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0))
  for (const layer of ordered) {
    if (!layer?.buffer || layer.buffer.byteLength < 32) continue
    const box = placedBox(layer, width, height)
    if (!box) continue
    const input = await sharp(layer.buffer).resize(box.width, box.height, { fit: "fill" }).png().toBuffer()
    overlays.push({ input, left: box.left, top: box.top })
  }
  if (overlays.length === erased) throw new Error("衣物图层没有可放置的位置")
  const buffer = await sharp(baseBuffer).composite(overlays).png().toBuffer()
  return { mediaType: "image/png", buffer }
}

function brief(error) {
  const text = error instanceof Error ? error.message : String(error || "")
  return text.replace(/\s+/g, " ").trim().slice(0, 180)
}

async function removeByEdit({ generate, worn, removalPrompt, call }) {
  const edited = await generate({
    ...call,
    prompt: removalPrompt,
    images: [{ mediaType: worn.mediaType || "image/png", buffer: worn.buffer, role: "costume" }],
    allowReferenceFallback: false,
    watermark: false,
    timeoutMs: 150000,
  })
  if (!edited?.buffer || edited.buffer.byteLength < 32) throw new Error("去人编辑没有返回图片")
  if (edited.referencesSent === false) throw new Error("去人编辑没有收下穿着图")
  return edited
}

export async function generateGhostCostume(input = {}) {
  const provider = input.provider
  const generate = input.generate ?? generateImage
  const decompose = input.decompose ?? decomposeSeedreamImage
  const optimize = input.sensitivePromptOptimize === true
  const model = String(input.model || "").trim() || defaultModel(provider)
  const wearPrompt = ensureWearPrompt(input.prompt, { adult: input.adult === true, sensitivePromptOptimize: optimize })
  const call = {
    provider,
    apiKey: input.apiKey,
    baseURL: input.baseURL ?? "",
    model,
    aspectRatio: input.aspectRatio,
    signal: input.signal,
    fetchImpl: input.fetchImpl,
  }
  const worn = await generate({
    ...call,
    prompt: wearPrompt,
    images: [],
    allowReferenceFallback: true,
    watermark: false,
    timeoutMs: 110000,
  })
  if (!worn?.buffer || worn.buffer.byteLength < 32) throw new Error("服装参考没有生成。请再试一次。")

  const canSplit = supportsCostumeLayerSplit(provider, model)
  if (canSplit) {
    try {
      const source = input.decompose
        ? { mediaType: worn.mediaType || "image/png", buffer: worn.buffer }
        : await prepareCostumeLayerImage(worn)
      const split = await decompose({
        ...call,
        prompt: costumeLayerPrompt(optimize),
        image: source,
        timeoutMs: 150000,
      })
      const selected = selectGhostLayers(split?.layers)
      if (!selected.ok) throw new Error(selected.reason)
      const image = await compositeGhostLayers(split.base.buffer, selected.keep, selected.erase)
      return { ...image, referencesSent: true, model }
    } catch {
      // The edit below is the fallback when layer split cannot be used.
    }
  }

  try {
    const edited = await removeByEdit({
      generate,
      worn,
      removalPrompt: costumeRemovalPrompt(optimize),
      call,
    })
    return {
      mediaType: edited.mediaType || "image/png",
      buffer: edited.buffer,
      referencesSent: true,
      model: edited.model || model,
    }
  } catch (error) {
    throw new Error(studioError(error))
  }
}
