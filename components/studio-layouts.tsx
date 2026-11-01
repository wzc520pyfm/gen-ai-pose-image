"use client"

import type { ReactNode } from "react"
import { ScrollShadow } from "@heroui/react"
import type { StudioLayoutId } from "@/lib/studio-layout"

export type StudioRegions = {
  characterDock: ReactNode
  library: ReactNode
  workOrder: ReactNode
  preview: ReactNode
  recipe?: ReactNode
  libraryRail?: ReactNode
  modelStrip?: ReactNode
  previewOverlay?: ReactNode
  workbenchDrawer?: ReactNode
  libraryHeading?: ReactNode
  librarySwitch?: ReactNode
}

export function StudioLayoutGrid({
  layout,
  regions,
}: {
  layout: StudioLayoutId
  regions: StudioRegions
}) {
  if (layout === "A") {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col" data-layout="A">
        <div className="grid min-h-0 flex-1 grid-cols-[72px_minmax(0,1fr)] overflow-hidden">
          <div className="min-h-0 overflow-hidden">{regions.libraryRail}</div>
          <ScrollShadow className="h-full min-h-0 overflow-y-auto">{regions.library}</ScrollShadow>
        </div>
        {regions.recipe}
        {regions.previewOverlay}
        {regions.workbenchDrawer}
      </div>
    )
  }
  if (layout === "B") {
    return (
      <div
        className="relative flex min-h-0 flex-1 flex-col @min-[1024px]/studio:grid @min-[1024px]/studio:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]"
        data-layout="B"
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0 px-3 pt-3">{regions.librarySwitch}</div>
          <ScrollShadow className="min-h-0 flex-1 overflow-y-auto">{regions.library}</ScrollShadow>
          <div className="shrink-0">{regions.modelStrip}</div>
        </div>
        <div className="flex min-h-[240px] w-full shrink-0 flex-col bg-[#f7f4ee] @min-[1024px]/studio:min-h-0">
          <div className="min-h-0 flex-1 overflow-hidden">{regions.preview}</div>
          <div className="shrink-0">{regions.recipe}</div>
        </div>
        {regions.workbenchDrawer}
      </div>
    )
  }
  if (layout === "D") {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col" data-layout="D">
        <div className="shrink-0 px-4 pt-3">{regions.librarySwitch}</div>
        <div className="shrink-0 px-4 pt-2">{regions.libraryHeading}</div>
        <ScrollShadow className="min-h-0 flex-1 overflow-y-auto">
          <div className="pb-28">{regions.library}</div>
        </ScrollShadow>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto max-w-[calc(100%-1.5rem)]">{regions.recipe}</div>
        </div>
        {regions.previewOverlay}
        {regions.workbenchDrawer}
      </div>
    )
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col @min-[1024px]/studio:grid @min-[1024px]/studio:grid-cols-[300px_minmax(0,1fr)_340px]" data-layout="C">
      {regions.characterDock}
      <main className="order-2 min-h-0 min-w-0 flex-1 overflow-y-auto @min-[1024px]/studio:order-none">
        {regions.library}
      </main>
      <aside className="hidden min-h-0 border-l bg-white px-4 py-5 @min-[1024px]/studio:block @min-[1024px]/studio:overflow-y-auto">
        {regions.workOrder}
      </aside>
    </div>
  )
}
