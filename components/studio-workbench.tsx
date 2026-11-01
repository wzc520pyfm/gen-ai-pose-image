"use client"

import type { ReactNode } from "react"
import { Disclosure, Drawer, ScrollShadow, Separator } from "@heroui/react"
import { useOverlayPortal } from "@/lib/studio-env"

export function WorkbenchDrawer({
  open,
  onOpenChange,
  placement,
  includeDock,
  modelName,
  dockExpanded,
  onDockExpanded,
  dock,
  composer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  placement: "bottom" | "right"
  includeDock: boolean
  modelName: string
  dockExpanded: boolean
  onDockExpanded: (open: boolean) => void
  dock: ReactNode
  composer: ReactNode
}) {
  const portal = useOverlayPortal()
  if (!open) return null
  return (
    <Drawer isOpen onOpenChange={onOpenChange}>
      <Drawer.Backdrop {...portal}>
        <Drawer.Content placement={placement}>
          <Drawer.Dialog className={placement === "right" ? "w-[min(400px,100%)] max-w-full" : "max-h-[min(85dvh,720px)]"}>
            {placement === "bottom" ? <Drawer.Handle /> : null}
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>工作单</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <ScrollShadow className="max-h-[inherit] overflow-y-auto">
                {includeDock ? (
                  <div className="grid gap-3">
                    <Disclosure isExpanded={dockExpanded} onExpandedChange={onDockExpanded}>
                      <Disclosure.Heading>
                        <Disclosure.Trigger className="flex w-full items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-left">{modelName}</span>
                          <Disclosure.Indicator />
                        </Disclosure.Trigger>
                      </Disclosure.Heading>
                      <Disclosure.Content>
                        <Disclosure.Body>{dock}</Disclosure.Body>
                      </Disclosure.Content>
                    </Disclosure>
                    <Separator />
                    {composer}
                  </div>
                ) : composer}
              </ScrollShadow>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  )
}
