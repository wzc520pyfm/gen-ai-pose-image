export function statusForStudioError(error) {
  const message = error instanceof Error ? error.message : String(error || "")
  if (/超时|timeout|aborted|AbortError|FUNCTION_INVOCATION_TIMEOUT/i.test(message)) return 504
  if (/暂时读不到|没有读到|没有连上|ECONN|ENOTFOUND|fetch failed|压缩失败/i.test(message)) return 502
  return 400
}

export function messageForStatus(status, bodyText, fallback) {
  const text = String(bodyText || "").trim()
  if (text) {
    try {
      const payload = JSON.parse(text)
      if (typeof payload?.error === "string" && payload.error.trim()) return payload.error.trim()
      if (typeof payload?.error?.message === "string" && payload.error.message.trim()) return payload.error.message.trim()
    } catch {
      // Gateway timeouts are often an HTML page, not JSON.
    }
  }
  if (status === 504 || status === 408) return "生图超时。模型这次没有在时限内返回，请再试一次。"
  if (status === 502 || status === 503) return "生图接口暂时没有连上，请再试一次。"
  return fallback
}
