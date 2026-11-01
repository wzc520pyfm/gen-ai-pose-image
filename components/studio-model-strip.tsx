"use client"

import type { ReactNode } from "react"
import { Avatar, Disclosure, Surface } from "@heroui/react"

export function ModelStrip({
  open,
  onOpenChange,
  name,
  thumbSrc,
  dock,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  thumbSrc: string
  dock: ReactNode
}) {
  return (
    <Surface data-region="model-strip" className="bg-[#0f172a] text-slate-100">
      <Disclosure isExpanded={open} onExpandedChange={onOpenChange}>
        <Disclosure.Heading>
          <Disclosure.Trigger className="flex w-full items-center gap-2 px-3 py-2 text-slate-100">
            <Avatar size="sm">
              <Avatar.Image src={thumbSrc} alt="" />
              <Avatar.Fallback>{name.slice(0, 1) || "模"}</Avatar.Fallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-left text-sm">{name}</span>
            <Disclosure.Indicator />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body>{dock}</Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </Surface>
  )
}
