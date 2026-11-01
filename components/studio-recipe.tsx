"use client"

import { Alert, Button, Spinner, Surface, Tag, TagGroup } from "@heroui/react"
import { busyLabel } from "@/shared/studio-recipe.mjs"

export type RecipeChip = {
  id: string
  kind: "face" | "costume" | "pose"
  label: string
  removable: boolean
}

export type RecipeAlert = {
  id: string
  status: "danger" | "warning"
  text: string
}

export function RecipeBar({
  variant,
  chips,
  scoreLabel,
  running,
  elapsed,
  blocked,
  alerts,
  onGenerate,
  onStop,
  onOpenWorkbench,
  onActivateChip,
  onRemoveChip,
  onViewResult,
  onRandom,
}: {
  variant: "dock" | "strip" | "pill"
  chips: RecipeChip[]
  scoreLabel: string
  running: boolean
  elapsed: number
  blocked: boolean
  alerts: RecipeAlert[]
  onGenerate: () => void
  onStop: () => void
  onOpenWorkbench: () => void
  onActivateChip: (chip: RecipeChip) => void
  onRemoveChip: (id: string) => void
  onViewResult?: () => void
  onRandom?: () => void
}) {
  return (
    <Surface
      data-region="recipe"
      data-variant={variant}
      className={[
        "bg-[#0f172a] text-slate-100",
        variant === "pill" ? "rounded-full px-3 py-2 shadow-lg" : "w-full px-3 py-2",
        variant === "dock" || variant === "strip" ? "pb-[max(0.5rem,env(safe-area-inset-bottom))]" : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {chips.map((chip) => (
            <TagGroup
              key={chip.id}
              aria-label={chip.label}
              onRemove={chip.removable ? () => onRemoveChip(chip.id) : undefined}
            >
              <TagGroup.List>
                <Tag id={chip.id} textValue={chip.label} onClick={() => onActivateChip(chip)}>
                  {chip.label}
                  {chip.removable ? <Tag.RemoveButton aria-label={`移除 ${chip.label}`} /> : null}
                </Tag>
              </TagGroup.List>
            </TagGroup>
          ))}
        </div>
        <span className="text-xs whitespace-nowrap text-slate-300">{scoreLabel}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {onRandom ? (
            <Button
              variant="outline"
              size="sm"
              className="border-[#fb7185]/50 bg-[#fff1f2] text-[#be123c]"
              isDisabled={running}
              onPress={onRandom}
            >
              随机组合
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onPress={onOpenWorkbench}>工作单</Button>
          {onViewResult ? <Button variant="secondary" size="sm" onPress={onViewResult}>看成图</Button> : null}
          {running ? (
            <>
              <Spinner size="sm" />
              <span className="text-sm whitespace-nowrap">{busyLabel(elapsed)}</span>
              <Button variant="danger" size="sm" onPress={onStop}>停止</Button>
            </>
          ) : (
            <Button variant="primary" size="sm" isDisabled={blocked} onPress={onGenerate}>生图</Button>
          )}
        </div>
      </div>
      {alerts.length > 0 ? (
        <div className="mt-2 grid gap-2">
          {alerts.map((alert) => (
            <Alert key={alert.id} status={alert.status}>
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{alert.text}</Alert.Description>
              </Alert.Content>
            </Alert>
          ))}
        </div>
      ) : null}
    </Surface>
  )
}
