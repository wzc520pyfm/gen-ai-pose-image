"use client"

import type { ReactNode, Ref } from "react"
import { Button, Dropdown, Label } from "@heroui/react"
import { LayoutGrid, Settings } from "lucide-react"
import { WhaleMark } from "@/components/whale-mark"
import { StudioLayoutGrid, type StudioRegions } from "@/components/studio-layouts"
import { useOverlayPortal } from "@/lib/studio-env"
import type { StudioLayoutId } from "@/lib/studio-layout"

const LAYOUT_OPTIONS: { id: StudioLayoutId; label: string }[] = [
  { id: "A", label: "A · 成图居中" },
  { id: "B", label: "B · 左素材右出图" },
  { id: "C", label: "C · 顶部分段 + 工作单" },
  { id: "D", label: "D · 剪辑台" },
]

export function StudioShell({
  layout,
  embedded = false,
  onLayoutChange,
  onOpenSettings,
  libraryTabs,
  headerTrailing,
  mobileWorkOrderTrigger,
  regions,
  showSettings = true,
  containerRef,
}: {
  layout: StudioLayoutId
  embedded?: boolean
  onLayoutChange: (id: StudioLayoutId) => void
  onOpenSettings: () => void
  libraryTabs?: ReactNode
  headerTrailing?: ReactNode
  mobileWorkOrderTrigger?: ReactNode
  regions: StudioRegions
  showSettings?: boolean
  containerRef?: Ref<HTMLDivElement>
}) {
  const portal = useOverlayPortal()
  return (
    <div ref={containerRef} className={`@container/studio flex min-h-0 flex-col overflow-hidden bg-background text-foreground ${embedded ? "h-full" : "h-dvh"}`}>
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-white px-3 py-2">
        <WhaleMark className="size-8 shrink-0" />
        <h1 className="shrink-0 text-base font-semibold">澜姿</h1>
        {libraryTabs}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {headerTrailing}
          <Dropdown>
            {/* Trigger optional: first child Button is the menu trigger (avoids nested <button>) */}
            <Button
              variant="secondary"
              size="sm"
              aria-label="切换布局"
              className="gap-1"
            >
              <LayoutGrid className="size-4" />
              布局 {layout}
            </Button>
            <Dropdown.Popover {...portal}>
              <Dropdown.Menu
                aria-label="布局"
                onAction={(key) => onLayoutChange(String(key) as StudioLayoutId)}
              >
                {LAYOUT_OPTIONS.map((option) => (
                  <Dropdown.Item key={option.id} id={option.id} textValue={option.label}>
                    <Label>{option.label}</Label>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          {showSettings ? (
            <Button variant="secondary" isIconOnly aria-label="生图设置" onPress={onOpenSettings}>
              <Settings className="size-4" />
            </Button>
          ) : null}
        </div>
      </header>
      <StudioLayoutGrid layout={layout} regions={regions} />
      {mobileWorkOrderTrigger}
    </div>
  )
}
