import { expandReferencePrompt } from "@/shared/custom.mjs"
import { messageForStatus } from "@/shared/http-status.mjs"
import type { StudioSettings } from "@/lib/settings"
import { studioUrl } from "@/lib/studio-env"

export type BeautifyResult = {
  prompt: string
  source: "template" | "model"
  notice: string
}

function fallback(kind: "pose" | "costume", userPrompt: string, adult: boolean, sensitivePromptOptimize: boolean, notice: string): BeautifyResult {
  return {
    prompt: expandReferencePrompt({ kind, userPrompt, adult, sensitivePromptOptimize }),
    source: "template",
    notice,
  }
}

export async function requestBeautify(basePath: string, settings: StudioSettings, input: {
  kind: "pose" | "costume"
  userPrompt: string
  adult: boolean
  hasKey: boolean
  sensitivePromptOptimize?: boolean
}): Promise<BeautifyResult> {
  const optimize = input.sensitivePromptOptimize === true
  if (!input.hasKey) {
    return fallback(input.kind, input.userPrompt, input.adult, optimize, "没有密钥，已在本地扩写。提示词可以复制。")
  }
  try {
    const response = await fetch(studioUrl(basePath, "/api/beautify"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: settings.provider,
        apiKey: settings.apiKey,
        baseURL: settings.baseURL,
        textModel: settings.textModel,
        kind: input.kind,
        userPrompt: input.userPrompt,
        adult: input.adult,
        sensitivePromptOptimize: optimize,
      }),
    })
    const payload = await response.json() as Partial<BeautifyResult> & { error?: string }
    if (!response.ok || typeof payload.prompt !== "string" || payload.prompt.trim() === "") {
      return fallback(input.kind, input.userPrompt, input.adult, optimize, payload.error || "文本接口不可用，已改用本地扩写。")
    }
    return {
      prompt: payload.prompt,
      source: payload.source === "model" ? "model" : "template",
      notice: typeof payload.notice === "string" ? payload.notice : "",
    }
  } catch {
    return fallback(input.kind, input.userPrompt, input.adult, optimize, "文本接口不可用，已改用本地扩写。")
  }
}

export async function requestReferenceImage(basePath: string, settings: StudioSettings, prompt: string, kind: "pose" | "costume") {
  const response = await fetch(studioUrl(basePath, "/api/reference"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: settings.provider,
      apiKey: settings.apiKey,
      baseURL: settings.baseURL,
      model: settings.model,
      aspectRatio: settings.aspectRatio,
      kind,
      prompt,
      sensitivePromptOptimize: settings.sensitivePromptOptimize === true,
    }),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(messageForStatus(response.status, text, "参考图没有生成"))
  let payload: { mediaType?: string; imageBase64?: string; warning?: string }
  try {
    payload = JSON.parse(text) as { mediaType?: string; imageBase64?: string; warning?: string }
  } catch {
    throw new Error("参考图没有生成")
  }
  if (!payload.imageBase64) throw new Error("参考图没有生成")
  return {
    mediaType: payload.mediaType || "image/png",
    imageBase64: payload.imageBase64,
    warning: typeof payload.warning === "string" ? payload.warning : "",
  }
}
