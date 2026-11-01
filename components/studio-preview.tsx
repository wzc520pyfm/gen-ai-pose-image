"use client"

/* eslint-disable @next/next/no-img-element -- preview shows result data URLs */

import { useState } from "react"
import type { ResultCard } from "@/components/composer"
import { Modal } from "@heroui/react"

export function PreviewPane({ results }: { results: ResultCard[] }) {
  const [zoomSrc, setZoomSrc] = useState<string | null>(null)
  const latest = [...results].reverse().find((item) => item.ok && item.src)

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center bg-[#f7f4ee] p-3">
      {latest?.src ? (
        <button
          type="button"
          className="flex h-full w-full items-center justify-center overflow-hidden"
          onClick={() => setZoomSrc(latest.src!)}
          aria-label="放大成图"
        >
          <img src={latest.src} alt={latest.title} className="max-h-full max-w-full object-contain" />
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">成图预览</p>
      )}
      <Modal.Backdrop isOpen={zoomSrc !== null} onOpenChange={(open) => { if (!open) setZoomSrc(null) }}>
        <Modal.Container size="cover">
          <Modal.Dialog className="max-w-[min(48rem,calc(100%-2rem))] p-2">
            <Modal.CloseTrigger />
            <Modal.Header className="sr-only">
              <Modal.Heading>成图预览</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {zoomSrc ? <img src={zoomSrc} alt="成图预览" className="max-h-[80dvh] w-full object-contain" /> : null}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  )
}

export function LayoutARail({
  library,
  onLibrary,
}: {
  library: "poses" | "costumes" | "faces"
  onLibrary: (next: "poses" | "costumes" | "faces") => void
}) {
  const tabs: Array<{ id: "poses" | "costumes" | "faces"; label: string }> = [
    { id: "poses", label: "姿势" },
    { id: "costumes", label: "服装" },
    { id: "faces", label: "脸部" },
  ]
  return (
    <div className="flex h-full flex-col gap-2 rounded-xl border bg-slate-950 p-2 text-slate-100" role="tablist" aria-label="图库">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={library === tab.id}
          onClick={() => onLibrary(tab.id)}
          className={`rounded-lg px-2 py-3 text-xs font-medium ${library === tab.id ? "bg-white text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
