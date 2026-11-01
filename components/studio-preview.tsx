"use client"

/* eslint-disable @next/next/no-img-element -- preview shows result data URLs */

import { useEffect, useState } from "react"
import { Button, Card, CloseButton, Drawer, Modal, Tabs } from "@heroui/react"
import type { ResultCard } from "@/components/composer"
import { useOverlayPortal } from "@/lib/studio-env"
import type { StudioLibrary } from "@/components/studio-library-tabs"

export function PreviewPane({ results }: { results: ResultCard[] }) {
  const [zoomSrc, setZoomSrc] = useState<string | null>(null)
  const portal = useOverlayPortal()
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
        <p className="text-sm text-muted-foreground">还没有成图。选好配方后点生图。</p>
      )}
      <Modal.Backdrop isOpen={zoomSrc !== null} onOpenChange={(open) => { if (!open) setZoomSrc(null) }} {...portal}>
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

export function PreviewFocus({
  open,
  onClose,
  results,
}: {
  open: boolean
  onClose: () => void
  results: ResultCard[]
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 p-3"
      onClick={onClose}
      role="presentation"
    >
      <Card
        className="relative max-h-[min(70dvh,40rem)] w-[min(56rem,70%)] overflow-hidden @max-[1023px]/studio:w-[calc(100%-24px)]"
        onClick={(event) => event.stopPropagation()}
      >
        <CloseButton aria-label="关闭成图" className="absolute top-2 right-2 z-10" onPress={onClose} />
        <Card.Header className="sr-only">
          <Card.Title>成图</Card.Title>
        </Card.Header>
        <Card.Content className="h-[min(64dvh,36rem)] p-0">
          <PreviewPane results={results} />
        </Card.Content>
      </Card>
    </div>
  )
}

export function PreviewDrawer({
  open,
  onOpenChange,
  placement,
  results,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  placement: "bottom" | "right"
  results: ResultCard[]
}) {
  const portal = useOverlayPortal()
  if (!open) return null
  return (
    <Drawer isOpen onOpenChange={onOpenChange}>
      <Drawer.Backdrop {...portal}>
        <Drawer.Content placement={placement}>
          <Drawer.Dialog className={placement === "bottom" ? "max-h-[70dvh]" : "w-[min(440px,100%)] max-w-full"}>
            {placement === "bottom" ? <Drawer.Handle /> : null}
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>成图</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="min-h-48">
              <PreviewPane results={results} />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  )
}

const RAIL_TABS: Array<{ id: StudioLibrary; label: string }> = [
  { id: "poses", label: "姿" },
  { id: "costumes", label: "服" },
  { id: "faces", label: "脸" },
]

export function LayoutARail({
  library,
  onLibrary,
  onOpenSettings,
}: {
  library: StudioLibrary
  onLibrary: (next: StudioLibrary) => void
  onOpenSettings: () => void
}) {
  return (
    <div className="flex h-full flex-col bg-[#0f172a] text-slate-100">
      <Tabs
        orientation="vertical"
        align="start"
        selectedKey={library}
        onSelectionChange={(key) => {
          if (key == null) return
          onLibrary(String(key) as StudioLibrary)
        }}
        className="min-h-0 flex-1"
      >
        <Tabs.ListContainer className="h-full">
          <Tabs.List aria-label="图库" className="flex h-full flex-col items-stretch gap-1 p-1">
            {RAIL_TABS.map((tab) => (
              <Tabs.Tab key={tab.id} id={tab.id} className="justify-center px-0 text-slate-100 [writing-mode:horizontal-tb]">
                {tab.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <Button variant="secondary" size="sm" className="m-1" aria-label="生图设置" onPress={onOpenSettings}>
        设
      </Button>
    </div>
  )
}
