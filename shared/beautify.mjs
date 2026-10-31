import { COSTUME_STYLE_LOCK, POSE_STYLE_LOCK, expandReferencePrompt } from "./custom.mjs"
import { defaultBaseURL, redact } from "./generate.mjs"

/** Empty uses the provider default. A filled id is sent as written, even if it looks like an image model. */
export function textModelFor(provider, textModel) {
  const name = String(textModel ?? "").trim()
  if (name) return name
  if (provider === "gemini") return "gemini-2.5-flash"
  if (provider === "openai") return "gpt-4o-mini"
  return "doubao-seed-2-1-pro-260628"
}

function describedError(payload, status, secret) {
  const error = payload?.error
  const code = typeof error === "object" && error && typeof error.code === "string" ? error.code.trim() : ""
  const message = typeof error === "object" && error && typeof error.message === "string"
    ? error.message.trim()
    : typeof error === "string"
      ? error.trim()
      : ""
  return redact([code, message].filter(Boolean).join("：") || `文本接口失败（${status}）`, secret)
}

export function beautifyInstruction({ kind, userPrompt = "", adult = false }) {
  const role = kind === "costume"
    ? `你在写服装参考图的文生图提示词。图里只能有衣服，不能有人、人台、假人、身体或皮肤，不要裸体。${COSTUME_STYLE_LOCK}`
    : `你在写姿势参考图的文生图提示词。图应是白底黑色线稿，球关节人偶，只表达成年身体的姿态，不要上色，不要服装设计。${POSE_STYLE_LOCK}`
  const safety = adult
    ? "用户已打开成人向。可以按描述包含暴露或亲密内容，但人物必须是成年人，禁止未成年人。"
    : "不要生成露骨内容：不要裸体、内衣、泳装或性暗示。"
  const note = String(userPrompt).trim()
  return [
    role,
    safety,
    "把简短描述扩写成一段可直接用于文生图的中文提示词。不要解释，不要加标题。",
    note ? `描述：${note}` : "描述：（用户没有写，请给出一个清楚、普通、非露骨的示例）",
  ].join("\n")
}

function cleanBeautifiedText(text) {
  return String(text ?? "")
    .trim()
    .replace(/^```(?:\w+)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()
    .slice(0, 4000)
}

function templateResult(input, notice = "") {
  return {
    prompt: expandReferencePrompt(input),
    source: "template",
    notice,
  }
}

async function readJson(response, secret) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(redact(text || `文本接口返回了无法解析的内容（${response.status}）`, secret))
  }
}

function geminiRoot(baseURL) {
  const base = (String(baseURL || "").trim() || defaultBaseURL("gemini")).replace(/\/$/, "")
  return base.endsWith("/v1beta") ? base : `${base}/v1beta`
}

async function geminiText({ apiKey, baseURL, model, instruction, fetchImpl, signal }) {
  const endpoint = `${geminiRoot(baseURL)}/models/${encodeURIComponent(model)}:generateContent`
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: instruction }] }],
    }),
    signal,
  })
  const payload = await readJson(response, apiKey)
  if (!response.ok) {
    throw new Error(describedError(payload, response.status, apiKey))
  }
  const parts = (payload?.candidates ?? []).flatMap((candidate) => candidate?.content?.parts ?? [])
  const text = parts.map((part) => part?.text).filter(Boolean).join("\n").trim()
  if (!text) throw new Error("模型没有返回文本")
  return text
}

async function chatText({ provider, apiKey, baseURL, model, instruction, fetchImpl, signal }) {
  const root = (String(baseURL || "").trim() || defaultBaseURL(provider === "seedream" ? "seedream" : "openai")).replace(/\/$/, "")
  const response = await fetchImpl(`${root}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "你只输出文生图提示词正文。" },
        { role: "user", content: instruction },
      ],
    }),
    signal,
  })
  const payload = await readJson(response, apiKey)
  if (!response.ok) {
    throw new Error(describedError(payload, response.status, apiKey))
  }
  const content = payload?.choices?.[0]?.message?.content
  const text = Array.isArray(content)
    ? content.map((part) => part?.text || part?.content || "").join("\n")
    : String(content || "")
  if (!text.trim()) throw new Error("模型没有返回文本")
  return text
}

export async function beautifyPrompt({
  provider,
  apiKey = "",
  baseURL = "",
  textModel = "",
  kind = "pose",
  userPrompt = "",
  adult = false,
  fetchImpl = fetch,
  signal,
} = {}) {
  const input = {
    kind: kind === "costume" ? "costume" : "pose",
    userPrompt,
    adult: adult === true,
  }
  const key = String(apiKey || "").trim()
  if (!key) return templateResult(input)
  const chosen = provider === "openai" || provider === "gemini" || provider === "seedream" ? provider : "gemini"
  try {
    const text = chosen === "gemini"
      ? await geminiText({
          apiKey: key,
          baseURL,
          model: textModelFor(chosen, textModel),
          instruction: beautifyInstruction(input),
          fetchImpl,
          signal,
        })
      : await chatText({
          provider: chosen,
          apiKey: key,
          baseURL,
          model: textModelFor(chosen, textModel),
          instruction: beautifyInstruction(input),
          fetchImpl,
          signal,
        })
    const prompt = cleanBeautifiedText(text)
    if (!prompt) return templateResult(input, "文本接口没有返回内容，已改用本地扩写。")
    return { prompt, source: "model", notice: "" }
  } catch (error) {
    const detail = redact(error instanceof Error ? error.message : String(error ?? ""), key).trim()
    return templateResult(input, detail ? `文本接口不可用，已改用本地扩写。${detail}` : "文本接口不可用，已改用本地扩写。")
  }
}
