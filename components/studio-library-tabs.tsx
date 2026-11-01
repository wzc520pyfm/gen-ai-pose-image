"use client"

import { Tabs } from "@heroui/react"

export type StudioLibrary = "poses" | "costumes" | "faces"

const TABS: Array<{ id: StudioLibrary; label: string }> = [
  { id: "poses", label: "姿势" },
  { id: "costumes", label: "服装" },
  { id: "faces", label: "脸部" },
]

export function LibraryTabs({
  library,
  onLibrary,
}: {
  library: StudioLibrary
  onLibrary: (next: StudioLibrary) => void
}) {
  return (
    <Tabs
      selectedKey={library}
      onSelectionChange={(key) => {
        if (key == null) return
        onLibrary(String(key) as StudioLibrary)
      }}
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label="图库">
          {TABS.map((tab) => (
            <Tabs.Tab key={tab.id} id={tab.id}>
              {tab.label}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  )
}
