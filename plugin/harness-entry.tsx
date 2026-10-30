import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Studio } from "@/components/studio"

declare const LANPOSE_STUDIO_CSS: string

export const name = "gen-ai-pose-image"
export const inject = ["slots"]

const SIDEBAR_LABEL = "澜姿 / 工作室"

type SlotRegister = (meta: Record<string, unknown>, component: unknown) => unknown

type SlotContext = {
  slots?: {
    inject: (slot: string, factory: () => unknown) => void
    register: SlotRegister
  }
}

function PosePanelIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="3.1" r="1.35" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 4.7v3.4M5.1 7.1h5.8M6.1 13.4 8 8.1l1.9 5.3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PoseStudio() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [mount, setMount] = useState<HTMLDivElement | null>(null)
  const [portalContainer, setPortalContainer] = useState<ShadowRoot | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" })
    if (!shadow.querySelector("style[data-lanpose-studio]")) {
      const style = document.createElement("style")
      style.dataset.lanposeStudio = ""
      style.textContent = LANPOSE_STUDIO_CSS
      shadow.appendChild(style)
    }
    let node = shadow.querySelector<HTMLDivElement>("[data-lanpose-mount]")
    if (!node) {
      node = document.createElement("div")
      node.dataset.lanposeMount = ""
      node.className = "lanpose-studio"
      shadow.appendChild(node)
    }
    setPortalContainer(shadow)
    setMount(node)
  }, [])

  return (
    <div ref={hostRef} data-lanpose-host="" style={{ height: "100%", width: "100%", minHeight: 0, minWidth: 0, flex: "1 1 auto" }}>
      {mount && portalContainer
        ? createPortal(
            <Studio embedded basePath="/dsh-pose-muse" portalContainer={portalContainer} />,
            mount,
          )
        : null}
    </div>
  )
}

export function apply(ctx: SlotContext) {
  if (!ctx.slots || typeof ctx.slots.inject !== "function" || typeof ctx.slots.register !== "function") return
  const register = ctx.slots.register.bind(ctx.slots)
  ctx.slots.inject("main", () => register({
    name: "main",
    key: "pose-muse",
  }, PoseStudio))
  ctx.slots.inject("sidebar.panellist", () => register({
    name: "sidebar.panellist",
    id: "pose-muse",
    order: 20,
    label: () => SIDEBAR_LABEL,
  }, PosePanelIcon))
}
