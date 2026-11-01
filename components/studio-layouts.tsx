"use client"

import type { ReactNode } from "react"

export type StudioRegions = {
  characterDock: ReactNode
  library: ReactNode
  workOrder: ReactNode
}

export function StudioLayoutGrid({ regions }: { regions: StudioRegions }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col @min-[1024px]/studio:grid @min-[1024px]/studio:grid-cols-[300px_minmax(0,1fr)_340px]" data-layout="C">
      {regions.characterDock}
      <main className="order-2 min-h-0 min-w-0 flex-1 overflow-y-auto bg-background @min-[1024px]/studio:order-none">
        {regions.library}
      </main>
      <aside className="hidden min-h-0 border-l border-border bg-card px-4 py-5 @min-[1024px]/studio:block @min-[1024px]/studio:overflow-y-auto">
        {regions.workOrder}
      </aside>
    </div>
  )
}
