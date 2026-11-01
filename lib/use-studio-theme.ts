"use client"

import { useEffect, useState } from "react"
import { useStudioEnv, type StudioPortal } from "@/lib/studio-env"
import {
  applyStudioTheme,
  loadStudioTheme,
  resolveStudioTheme,
  saveStudioTheme,
  type StudioThemePreference,
} from "@/lib/studio-theme"

export function useStudioTheme() {
  const { portalContainer } = useStudioEnv()
  const [preference, setPreference] = useState<StudioThemePreference>("system")
  const [systemDark, setSystemDark] = useState(false)

  useEffect(() => {
    setPreference(loadStudioTheme())
  }, [])

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const update = () => setSystemDark(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  const resolved = resolveStudioTheme(preference, systemDark)

  useEffect(() => {
    applyStudioTheme(document.documentElement, resolved)
    applyPortalTheme(portalContainer, resolved)
  }, [portalContainer, resolved])

  function toggle() {
    const next = resolved === "dark" ? "light" : "dark"
    setPreference(next)
    saveStudioTheme(next)
  }

  return { preference, resolved, toggle }
}

function applyPortalTheme(portalContainer: StudioPortal, mode: "light" | "dark") {
  if (!(portalContainer instanceof ShadowRoot)) return
  const host = portalContainer.host
  if (host instanceof HTMLElement) applyStudioTheme(host, mode)
}
