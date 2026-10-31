const BLOCKED_HOSTS = new Set(["169.254.169.254", "metadata.google.internal"])

export function defaultModel(provider) {
  if (provider === "gemini") return "gemini-2.5-flash-image"
  if (provider === "seedream") return "doubao-seedream-5-0-flash-260915"
  return "gpt-image-1"
}

export function defaultBaseURL(provider) {
  if (provider === "gemini") return "https://generativelanguage.googleapis.com/v1beta"
  if (provider === "seedream") return "https://ark.cn-beijing.volces.com/api/v3"
  return "https://api.openai.com/v1"
}

const SEEDREAM_SIZE = {
  "1:1": "2048x2048",
  "3:4": "1728x2304",
  "4:3": "2304x1728",
  "9:16": "1600x2848",
  "16:9": "2848x1600",
}

export function seedreamSize(aspectRatio) {
  return SEEDREAM_SIZE[aspectRatio] || SEEDREAM_SIZE["3:4"]
}

export function openAISize(aspectRatio) {
  if (aspectRatio === "1:1") return "1024x1024"
  if (aspectRatio === "4:3" || aspectRatio === "16:9") return "1536x1024"
  return "1024x1536"
}

export function assertBaseURL(baseURL) {
  const text = String(baseURL ?? "").trim()
  if (!text) return ""
  let url
  try {
    url = new URL(text)
  } catch {
    throw new Error("接口地址无效")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("接口地址需以 http 或 https 开头")
  }
  const host = url.hostname.toLowerCase()
  if (BLOCKED_HOSTS.has(host)) throw new Error("这个接口地址不能使用")
  return url.toString().replace(/\/$/, "")
}

export function redact(text, secret) {
  const value = String(text ?? "")
  const hidden = secret ? value.split(secret).join("***") : value
  return hidden.slice(0, 800)
}

export function extractGeminiImage(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : []
  const parts = candidates.flatMap((candidate) => candidate?.content?.parts ?? [])
  for (const part of parts) {
    const inline = part?.inlineData || part?.inline_data
    if (inline?.data) {
      return {
        mediaType: inline.mimeType || inline.mime_type || "image/png",
        base64: inline.data,
      }
    }
  }
  const text = parts.map((part) => part?.text).filter(Boolean).join("\n").trim()
  const reason = payload?.promptFeedback?.blockReason || candidates[0]?.finishReason
  throw new Error(text || (reason ? `模型没有返回图片（${reason}）` : "模型没有返回图片"))
}

export function extractOpenAIImage(payload) {
  const item = payload?.data?.[0]
  if (typeof item?.b64_json === "string" && item.b64_json.length > 0) {
    return { mediaType: "image/png", base64: item.b64_json }
  }
  if (typeof item?.url === "string" && item.url.length > 0) {
    return { mediaType: "image/png", url: item.url }
  }
  throw new Error(payload?.error?.message || "模型没有返回图片")
}

function geminiEndpoint(baseURL, model) {
  const base = (baseURL || defaultBaseURL("gemini")).replace(/\/$/, "")
  const root = base.endsWith("/v1beta") ? base : `${base}/v1beta`
  return `${root}/models/${encodeURIComponent(model)}:generateContent`
}

async function readPayload(response, secret) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(redact(text || `接口返回了无法解析的内容（${response.status}）`, secret))
  }
}

function fail(payload, response, secret, fallback) {
  const message = payload?.error?.message || payload?.error?.status || fallback
  throw new Error(redact(`${message}（${response.status}）`, secret))
}

async function asBuffer(extracted, secret, signal) {
  if (extracted.base64) {
    return {
      mediaType: extracted.mediaType || "image/png",
      buffer: Buffer.from(extracted.base64, "base64"),
    }
  }
  const response = await fetch(extracted.url, { signal })
  if (!response.ok) throw new Error(redact(`图片下载失败（${response.status}）`, secret))
  const buffer = Buffer.from(await response.arrayBuffer())
  const mediaType = response.headers.get("content-type")?.split(";")[0] || extracted.mediaType || "image/png"
  return { mediaType, buffer }
}

function linkSignal(signal, ms) {
  const timeout = AbortSignal.timeout(ms)
  if (!signal) return timeout
  if (typeof AbortSignal.any === "function") return AbortSignal.any([signal, timeout])
  return signal
}

function timeoutMessage(error) {
  if (error?.name === "TimeoutError") return "生图超时。模型这次没有在时限内返回，请再试一次。"
  return ""
}

export async function generateImage({
  provider,
  apiKey,
  baseURL,
  model,
  prompt,
  images,
  aspectRatio,
  signal,
  fetchImpl = fetch,
  allowReferenceFallback = true,
  watermark = true,
  timeoutMs = 240000,
}) {
  if (!apiKey) throw new Error("还没有填写 API Key")
  const linked = linkSignal(signal, timeoutMs)
  const chosenModel = model || defaultModel(provider)
  try {
    if (provider === "gemini") {
      return await generateGemini({ apiKey, baseURL, model: chosenModel, prompt, images, aspectRatio, signal: linked, fetchImpl })
    }
    if (provider === "seedream") {
      return await generateSeedream({ apiKey, baseURL, model: chosenModel, prompt, images, aspectRatio, signal: linked, fetchImpl, allowReferenceFallback, watermark })
    }
    return await generateOpenAI({ apiKey, baseURL, model: chosenModel, prompt, images, aspectRatio, signal: linked, fetchImpl, allowReferenceFallback })
  } catch (error) {
    const timedOut = timeoutMessage(error)
    if (timedOut && !signal?.aborted) throw new Error(timedOut)
    throw error
  }
}

async function generateSeedream({ apiKey, baseURL, model, prompt, images, aspectRatio, signal, fetchImpl, allowReferenceFallback = true, watermark = true }) {
  const root = (baseURL || defaultBaseURL("seedream")).replace(/\/$/, "")
  const send = async (withReferences) => {
    const body = {
      model,
      prompt,
      size: seedreamSize(aspectRatio),
      response_format: "url",
      stream: false,
      watermark: watermark !== false,
    }
    if (withReferences && images.length > 0) {
      body.image = images.map((image) => `data:${image.mediaType};base64,${image.buffer.toString("base64")}`)
    }
    const response = await fetchImpl(`${root}/images/generations`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    })
    const payload = await readPayload(response, apiKey)
    return { response, payload }
  }
  let usedReferences = images.length > 0
  let { response, payload } = await send(usedReferences)
  if (!response.ok && usedReferences && allowReferenceFallback) {
    const message = payload?.error?.message || ""
    if (/image|reference|参考图|参考图片/i.test(message)) {
      usedReferences = false
      ;({ response, payload } = await send(false))
    }
  }
  if (!response.ok) fail(payload, response, apiKey, "Seedream 生图失败")
  const extracted = extractOpenAIImage(payload)
  const image = await asBuffer(extracted, apiKey, signal)
  return {
    ...image,
    referencesSent: usedReferences,
    warning: usedReferences ? undefined : "Seedream 这次没有收下参考图，成图只按文字描述，角色和姿势可能对不齐。",
    model,
  }
}

async function generateGemini({ apiKey, baseURL, model, prompt, images, aspectRatio, signal, fetchImpl }) {
  const endpoint = geminiEndpoint(baseURL, model)
  const body = {
    contents: [{
      role: "user",
      parts: [
        { text: `${prompt}\n输出比例：${aspectRatio}。` },
        ...images.map((image) => ({
          inline_data: {
            mime_type: image.mediaType,
            data: image.buffer.toString("base64"),
          },
        })),
      ],
    }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: { aspectRatio },
    },
  }
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
    signal,
  })
  const payload = await readPayload(response, apiKey)
  if (!response.ok) fail(payload, response, apiKey, "Gemini 生图失败")
  const extracted = extractGeminiImage(payload)
  const image = await asBuffer(extracted, apiKey, signal)
  return { ...image, referencesSent: images.length > 0, model }
}

function canFallBack(status, message) {
  if (status === 404 || status === 405 || status === 415 || status === 501) return true
  return /edits|not supported|unknown|multipart|invalid endpoint|no such/i.test(message)
}

async function generateOpenAI({ apiKey, baseURL, model, prompt, images, aspectRatio, signal, fetchImpl, allowReferenceFallback = true }) {
  const root = (baseURL || defaultBaseURL("openai")).replace(/\/$/, "")
  const size = openAISize(aspectRatio)
  if (images.length > 0) {
    try {
      return await openAIEdits({ apiKey, root, model, prompt, images, size, signal, fetchImpl })
    } catch (error) {
      if (!error.fallback || !allowReferenceFallback) throw error
    }
  }
  const image = await openAIGenerations({ apiKey, root, model, prompt, size, signal, fetchImpl })
  return {
    ...image,
    referencesSent: false,
    warning: "这个接口没有接收参考图，成图只按文字描述，角色和姿势可能对不齐。",
    model,
  }
}

async function openAIEdits({ apiKey, root, model, prompt, images, size, signal, fetchImpl }) {
  const form = new FormData()
  form.set("model", model)
  form.set("prompt", prompt)
  form.set("size", size)
  form.set("n", "1")
  images.forEach((image, index) => {
    const ext = image.mediaType === "image/png" ? "png" : image.mediaType === "image/webp" ? "webp" : "jpg"
    const blob = new Blob([new Uint8Array(image.buffer)], { type: image.mediaType })
    form.append("image", blob, `ref-${index}.${ext}`)
  })
  const response = await fetchImpl(`${root}/images/edits`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
    signal,
  })
  const payload = await readPayload(response, apiKey)
  if (!response.ok) {
    const message = payload?.error?.message || "编辑接口失败"
    const error = new Error(redact(`${message}（${response.status}）`, apiKey))
    error.fallback = canFallBack(response.status, message)
    throw error
  }
  const extracted = extractOpenAIImage(payload)
  const image = await asBuffer(extracted, apiKey, signal)
  return { ...image, referencesSent: true, model }
}

async function openAIGenerations({ apiKey, root, model, prompt, size, signal, fetchImpl }) {
  const send = async (withFormat) => {
    const body = { model, prompt, size, n: 1 }
    if (withFormat) body.response_format = "b64_json"
    const response = await fetchImpl(`${root}/images/generations`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    })
    const payload = await readPayload(response, apiKey)
    return { response, payload }
  }
  let { response, payload } = await send(true)
  const formatRejected = !response.ok && /response_format/i.test(payload?.error?.message || "")
  if (formatRejected) ({ response, payload } = await send(false))
  if (!response.ok) fail(payload, response, apiKey, "文生图失败")
  const extracted = extractOpenAIImage(payload)
  return asBuffer(extracted, apiKey, signal)
}

function box4(value) {
  if (!Array.isArray(value) || value.length < 4) return null
  const nums = value.slice(0, 4).map(Number)
  if (nums.some((item) => !Number.isFinite(item))) return null
  return nums
}

/** Seedream 5.0 pro/flash layer split. Base is z_index 0. Later layers carry name, description, and a box. */
export function parseSeedreamLayers(payload) {
  const data = Array.isArray(payload?.data) ? payload.data : []
  const items = data.filter((item) => item && (item.url || item.b64_json))
  const indexed = items.filter((item) => item.z_index !== undefined && item.z_index !== null && Number.isFinite(Number(item.z_index)))
  if (indexed.length < 2) {
    throw new Error("接口没有返回图层，没法把人和衣服拆开。")
  }
  const mapped = indexed.map((item) => ({
    zIndex: Number(item.z_index),
    name: typeof item.name === "string" ? item.name : "",
    description: typeof item.description === "string" ? item.description : "",
    absolute: box4(item.bounding_box?.absolute),
    normalized: box4(item.bounding_box?.normalized),
    url: typeof item.url === "string" ? item.url : "",
    base64: typeof item.b64_json === "string" ? item.b64_json : "",
    mediaType: item.output_format === "jpeg" ? "image/jpeg" : "image/png",
  }))
  const base = mapped.find((item) => item.zIndex === 0)
  if (!base) throw new Error("图层拆分没有返回底图。")
  const layers = mapped.filter((item) => item !== base).sort((a, b) => a.zIndex - b.zIndex)
  if (layers.length === 0) throw new Error("图层拆分没有返回衣物或人物图层。")
  return { base, layers }
}

export async function decomposeSeedreamImage({
  apiKey,
  baseURL,
  model,
  prompt,
  image,
  signal,
  fetchImpl = fetch,
  timeoutMs = 150000,
} = {}) {
  if (!apiKey) throw new Error("还没有填写 API Key")
  if (!image?.buffer || image.buffer.byteLength < 32) throw new Error("没有可拆分的穿着图")
  const linked = linkSignal(signal, timeoutMs)
  const mediaType = image.mediaType === "image/png" ? "image/png" : "image/jpeg"
  const root = (baseURL || defaultBaseURL("seedream")).replace(/\/$/, "")
  const chosenModel = model || defaultModel("seedream")
  const response = await fetchImpl(`${root}/images/generations`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: chosenModel,
      prompt,
      image: `data:${mediaType};base64,${image.buffer.toString("base64")}`,
      size: "auto",
      response_format: "url",
      stream: false,
      watermark: false,
      layer_decomposition: true,
      output_format: "png",
    }),
    signal: linked,
  })
  const payload = await readPayload(response, apiKey)
  if (!response.ok) fail(payload, response, apiKey, "图层拆分失败")
  const parsed = parseSeedreamLayers(payload)
  const load = async (item) => {
    if (item.base64) return asBuffer({ mediaType: item.mediaType, base64: item.base64 }, apiKey, linked)
    if (item.url) return asBuffer({ mediaType: item.mediaType, url: item.url }, apiKey, linked)
    throw new Error("图层拆分有一张图没有内容")
  }
  try {
    const [baseImage, ...layerImages] = await Promise.all([
      load(parsed.base),
      ...parsed.layers.map((item) => load(item)),
    ])
    return {
      base: { buffer: baseImage.buffer, mediaType: baseImage.mediaType || "image/png" },
      layers: parsed.layers.map((item, index) => ({
        zIndex: item.zIndex,
        name: item.name,
        description: item.description,
        absolute: item.absolute,
        normalized: item.normalized,
        buffer: layerImages[index].buffer,
        mediaType: layerImages[index].mediaType || "image/png",
      })),
    }
  } catch (error) {
    const timedOut = timeoutMessage(error)
    if (timedOut && !signal?.aborted) throw new Error(timedOut)
    throw error
  }
}
