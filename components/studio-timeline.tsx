"use client"

import { Sparkles } from "lucide-react"
import { Button, Spinner } from "@heroui/react"

export function TimelineBar({
  poseCount,
  costumeLabel,
  faceLabel,
  running,
  progress,
  elapsed = 0,
  onGenerate,
  onStop,
}: {
  poseCount: number
  costumeLabel?: string | null
  faceLabel?: string | null
  running: boolean
  progress?: string
  elapsed?: number
  onGenerate: () => void
  onStop: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs">姿势 {poseCount}</span>
      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs">{costumeLabel ? `服装 ${costumeLabel}` : "未选服装"}</span>
      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs">{faceLabel ? `脸部 ${faceLabel}` : "保持原脸"}</span>
      <div className="ml-auto flex items-center gap-2">
        {running ? (
          <>
            <Spinner size="sm" />
            <span className="text-sm text-slate-100" title={progress || undefined}>正在生成 · {elapsed}s</span>
            <Button variant="danger" size="sm" onPress={onStop}>停止</Button>
          </>
        ) : (
          <Button className="h-9" variant="primary" onPress={onGenerate}>
            <Sparkles />
            生图
          </Button>
        )}
      </div>
    </div>
  )
}
