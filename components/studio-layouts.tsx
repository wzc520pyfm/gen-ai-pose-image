"use client"

import type { ReactNode } from "react"
import type { StudioLayoutId } from "@/lib/studio-layout"

export type StudioRegions = {
  characterDock: ReactNode
  library: ReactNode
  workOrder: ReactNode
  preview: ReactNode
  timeline?: ReactNode
  libraryRail?: ReactNode // layout A vertical pose/costume/face entries
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
      <div className="grid min-h-0 flex-1 grid-cols-[72px_minmax(0,1fr)_300px] gap-3 p-3">
        <div className="min-h-0 overflow-y-auto">{regions.libraryRail ?? regions.library}</div>
        <div className="min-h-0 overflow-hidden rounded-xl border border-primary/40 bg-white">{regions.preview}</div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {regions.characterDock}
          {regions.workOrder}
        </div>
      </div>
    )
  }
  if (layout === "B") {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.2fr)_minmax(280px,0.9fr)] gap-3 p-3">
        <div className="min-h-0 overflow-y-auto rounded-xl border bg-white">{regions.library}</div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-white">{regions.preview}</div>
          {regions.workOrder}
        </div>
      </div>
    )
  }
  if (layout === "D") {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
          <div className="min-h-0 overflow-y-auto rounded-xl border bg-white">{regions.library}</div>
          <div className="min-h-0 overflow-hidden rounded-xl border border-primary/40 bg-white">{regions.preview}</div>
        </div>
        <div className="shrink-0 rounded-xl bg-slate-950 text-slate-100">{regions.timeline ?? regions.workOrder}</div>
      </div>
    )
  }
  // C default — near current: dock | library | work order
  return (
    <div className="flex min-h-0 flex-1 flex-col @min-[1024px]/studio:grid @min-[1024px]/studio:grid-cols-[300px_minmax(0,1fr)_340px]">
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
