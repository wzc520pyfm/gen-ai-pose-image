import { applyEnvCredentials } from "./credentials.mjs"
import { assertBaseURL, defaultBaseURL, geminiRoot, generateImage, providerFetch, redact } from "./generate.mjs"

async function readModelDirectory({ provider, baseURL, apiKey, fetchImpl, signal, checkOnly }) {
  const gemini = provider === "gemini"
  const url = new URL(`${gemini ? geminiRoot(baseURL) : baseURL}/models`)
  const headers = gemini ? { "x-goog-api-key": apiKey } : { authorization: `Bearer ${apiKey}` }
  if (gemini) url.searchParams.set("pageSize", checkOnly ? "1" : "1000")
  const models = new Map()
  const tokens = new Set()
  const started = performance.now()
  for (;;) {
    const response = await fetchImpl(url, { headers, signal, cache: "no-store" })
    const payload = await response.json().catch(() => null)
    if (!response.ok || payload?.error) {
      const detail = payload?.error?.message || (typeof payload?.error === "string" ? payload.error : "")
      const message = detail || (checkOnly ? "连接检测失败" : "获取模型列表失败")
      throw Object.assign(new Error(`${message}（HTTP ${response.status}）`), { status: response.ok ? 502 : response.status })
    }
    // Gemini may omit its repeated "models" field on an empty page.
    const emptyPage = payload && !Array.isArray(payload) && typeof payload === "object" && Object.keys(payload).every(key => key === "nextPageToken")
    const rows = gemini ? payload?.models ?? (emptyPage ? [] : undefined) : payload?.data
    if (!Array.isArray(rows)) throw new Error("接口返回的模型列表格式无效，请检查接口根地址。")
    if (checkOnly) {
      const idField = gemini ? "name" : "id"
      if (rows.length && !rows.some(row => typeof row?.[idField] === "string" && row[idField].trim())) {
        throw new Error("模型目录缺少模型标识，请检查接口根地址。")
      }
      return { connected: true, latencyMs: Math.round(performance.now() - started) }
    }
    for (const row of rows) {
      if (gemini && Array.isArray(row?.supportedGenerationMethods) && !row.supportedGenerationMethods.includes("generateContent")) continue
      const name = gemini ? row?.name : row?.id
      if (typeof name !== "string") continue
      const id = (gemini ? name.replace(/^models\//, "") : name).trim()
      if (!id || models.has(id)) continue
      const outputs = row.modalities?.output_modalities ?? row.architecture?.output_modalities
      models.set(id, { id, ...(Array.isArray(outputs) && outputs.length ? { outputs: outputs.map(type => String(type).toLowerCase()) } : {}) })
    }
    const next = gemini && payload.nextPageToken
    if (!next) break
    if (tokens.has(next)) throw new Error("接口重复返回了同一页模型，请重新获取列表。")
    tokens.add(next)
    url.searchParams.set("pageToken", next)
  }
  return { models: [...models.values()].sort((a, b) => a.id.localeCompare(b.id)) }
}

async function testImage(options) {
  const image = await generateImage({
    ...options,
    prompt: "请画一个居中的蓝色实心圆，纯白背景，无文字。",
    images: [],
    aspectRatio: "1:1",
  })
  const { default: sharp } = await import("sharp")
  let thumbnail
  try {
    thumbnail = await sharp(image.buffer)
      .resize({ width: 96, height: 96, fit: "inside", withoutEnlargement: true })
      .png().toBuffer()
  } catch {
    throw new Error("接口返回的内容无法解码为图片，请检查生图模型。")
  }
  return { model: image.model, previewBase64: thumbnail.toString("base64") }
}

export async function runProviderAction(input, { config = {}, signal } = {}) {
  if (!["test-connection", "list-models", "test-image"].includes(input?.action)) throw new Error("不支持的接口测试操作。")
  const checkOnly = input.action === "test-connection"
  if (input.engine === "comfyui") throw new Error("请使用 ComfyUI 的测试连接。")
  const { provider, model, baseURL: root, apiKey } = applyEnvCredentials(input, config)
  if (!["openai", "seedream", "gemini"].includes(provider)) throw new Error("不支持的云端接口")
  if (!apiKey) {
    if (applyEnvCredentials({ provider }, config).apiKey) {
      throw new Error("请为当前接口填写 API Key。服务端密钥仅用于服务端配置的接口。")
    }
    throw new Error("请先填写当前服务商的 API Key，或在服务端配置该服务商的密钥。")
  }
  const baseURL = assertBaseURL(root) || defaultBaseURL(provider)
  const send = providerFetch(baseURL)
  const fetchImpl = async (url, init) => {
    // Provider credentials must stay at the configured endpoint. Image downloads have no credentials.
    const response = await send(url, init.headers ? { ...init, redirect: "error" } : init)
    if (init.headers && !response.ok) {
      const hints = {
        401: "鉴权失败，请检查 API Key",
        403: "访问被拒绝，请检查 API Key 的模型权限",
        404: input.action === "test-image" ? "未找到接口或生图模型，请检查根地址和模型 ID" : "未找到模型目录，请检查根地址，或手动填写模型 ID 后使用「测试生图」验证",
        429: "接口触发限流或额度不足",
      }
      if (hints[response.status]) {
        await response.body?.cancel()
        throw Object.assign(new Error(`${hints[response.status]}（HTTP ${response.status}）`), { status: response.status })
      }
    }
    return response
  }
  try {
    const options = { provider, model, baseURL, apiKey, fetchImpl, signal }
    if (input.action === "test-image") return await testImage(options)
    const timeout = AbortSignal.timeout(checkOnly ? 8000 : 20000)
    return await readModelDirectory({ ...options, checkOnly, signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
  } catch (error) {
    if (error?.name === "TimeoutError") throw new Error(checkOnly ? "连接检测超时，请检查接口根地址和网络。" : "获取模型列表超时，请重试。")
    const detail = redact(error?.message || "接口请求失败", apiKey)
    if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(detail)) throw Object.assign(new Error("未能连接模型接口，请检查根地址和网络。"), { status: 502 })
    if (detail.trimStart().startsWith("<")) throw new Error("接口返回了网页，请检查接口根地址。")
    throw Object.assign(new Error(detail), { status: error?.status })
  }
}
