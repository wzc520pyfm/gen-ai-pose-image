"use client"

import type { ReactNode } from "react"
import { ToggleButtonGroup } from "@heroui/react"

export function SegmentRow({
  ariaLabel,
  selectedKey,
  onSelectionChange,
  className = "",
  children,
}: {
  ariaLabel: string
  selectedKey: string
  onSelectionChange: (keys: Iterable<unknown> | "all") => void
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`max-w-full overflow-x-auto ${className}`}>
      <ToggleButtonGroup
        aria-label={ariaLabel}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[selectedKey]}
        onSelectionChange={onSelectionChange}
        className="w-max flex-nowrap gap-0"
      >
        {children}
      </ToggleButtonGroup>
    </div>
  )
}
