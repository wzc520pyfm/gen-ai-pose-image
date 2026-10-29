const BLOCKED_HOSTS = new Set(["169.254.169.254", "metadata.google.internal"])

export function defaultModel(provider) {
  return provider === "gemini" ? "gemini-2.5-flash-image" : "gpt-image-1"
}

export function defaultBaseURL(provider) {
  return provider === "gemini"
    ? "https://generativelanguage.googleapis.com/v1beta"
    : "https://api.openai.com/v1"
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
}) {
  if (!apiKey) throw new Error("还没有填写 API Key")
  const chosenModel = model || defaultModel(provider)
  if (provider === "gemini") {
    return generateGemini({ apiKey, baseURL, model: chosenModel, prompt, images, aspectRatio, signal, fetchImpl })
  }
  return generateOpenAI({ apiKey, baseURL, model: chosenModel, prompt, images, aspectRatio, signal, fetchImpl })
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

async function generateOpenAI({ apiKey, baseURL, model, prompt, images, aspectRatio, signal, fetchImpl }) {
  const root = (baseURL || defaultBaseURL("openai")).replace(/\/$/, "")
  const size = openAISize(aspectRatio)
  if (images.length > 0) {
    try {
      return await openAIEdits({ apiKey, root, model, prompt, images, size, signal, fetchImpl })
    } catch (error) {
      if (!error.fallback) throw error
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
