"use client"

import { createContext, useContext, type ReactNode } from "react"
import { overlayPortalProps } from "@/shared/studio-portal.mjs"

export type StudioPortal = HTMLElement | ShadowRoot | null

type StudioEnv = {
  basePath: string
  portalContainer: StudioPortal
}

const StudioEnvContext = createContext<StudioEnv>({
  basePath: "",
  portalContainer: null,
})

export function StudioEnvProvider({
  basePath,
  portalContainer,
  children,
}: StudioEnv & { children: ReactNode }) {
  return <StudioEnvContext.Provider value={{ basePath, portalContainer }}>{children}</StudioEnvContext.Provider>
}

export function useStudioEnv() {
  return useContext(StudioEnvContext)
}

export function useOverlayPortal() {
  const { portalContainer } = useStudioEnv()
  return overlayPortalProps(portalContainer)
}

export function studioUrl(basePath: string, path: string) {
  if (!path.startsWith("/")) return path
  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath
  return `${base}${path}`
}
