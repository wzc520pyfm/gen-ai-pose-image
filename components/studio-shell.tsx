"use client"

import type { ReactNode, Ref } from "react"
import { Button } from "@heroui/react"
import { Moon, Settings, Sun } from "lucide-react"
import { WhaleMark } from "@/components/whale-mark"
import { StudioLayoutGrid, type StudioRegions } from "@/components/studio-layouts"

export function StudioShell({
  embedded = false,
  theme,
  onToggleTheme,
  onOpenSettings,
  libraryTabs,
  headerTrailing,
  mobileWorkOrderTrigger,
  regions,
  containerRef,
}: {
  embedded?: boolean
  theme: "light" | "dark"
  onToggleTheme: () => void
  onOpenSettings: () => void
  libraryTabs?: ReactNode
  headerTrailing?: ReactNode
  mobileWorkOrderTrigger?: ReactNode
  regions: StudioRegions
  containerRef?: Ref<HTMLDivElement>
}) {
  return (
    <div ref={containerRef} className={`@container/studio flex min-h-0 flex-col overflow-hidden bg-background text-foreground ${embedded ? "h-full" : "h-dvh"}`}>
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-card px-3 py-2">
        <WhaleMark className="size-8 shrink-0" />
        <h1 className="shrink-0 text-base font-semibold">澜姿</h1>
        {libraryTabs}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {headerTrailing}
          <Button
            variant="secondary"
            isIconOnly
            aria-label={theme === "dark" ? "切换到浅色" : "切换到深色"}
            onPress={onToggleTheme}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button variant="secondary" isIconOnly aria-label="生图设置" onPress={onOpenSettings}>
            <Settings className="size-4" />
          </Button>
        </div>
      </header>
      <StudioLayoutGrid regions={regions} />
      {mobileWorkOrderTrigger}
    </div>
  )
}
