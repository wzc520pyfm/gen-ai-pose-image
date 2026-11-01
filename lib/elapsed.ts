"use client"

import { useEffect, useState } from "react"

/** Seconds since `active` became true. Resets when the request finishes, fails, or is cancelled. */
export function useElapsedSeconds(active: boolean) {
  const [waited, setWaited] = useState(0)
  useEffect(() => {
    if (!active) {
      setWaited(0)
      return
    }
    const started = Date.now()
    const timer = window.setInterval(() => {
      setWaited(Math.max(1, Math.round((Date.now() - started) / 1000)))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [active])
  return waited
}

export function withElapsed(label: string, waited: number) {
  return waited > 0 ? `${label}（已等待 ${waited} 秒）` : label
}

/** Compact busy label, e.g. 正在生成 · 28s, short enough to leave a neighboring Stop control visible. */
export function compactElapsed(label: string, waited: number) {
  return waited > 0 ? `${label} · ${waited}s` : label
}
