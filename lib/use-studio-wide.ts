"use client"

import { useLayoutEffect, useState, type RefObject } from "react"
import { isStudioWide } from "@/shared/studio-chrome.mjs"

export function useStudioWide(ref: RefObject<HTMLElement | null>) {
  const [wide, setWide] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = (width: number) => setWide(isStudioWide(width))
    update(el.getBoundingClientRect().width)
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      update(entries[0]?.contentRect.width ?? 0)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return wide
}
