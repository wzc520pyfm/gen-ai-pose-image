"use client"

import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export function TimelineBar({
  poseCount,
  costumeLabel,
  faceLabel,
  running,
  progress,
  onGenerate,
  onStop,
}: {
  poseCount: number
  costumeLabel?: string | null
  faceLabel?: string | null
  running: boolean
  progress?: string
  onGenerate: () => void
  onStop: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs">姿势 {poseCount}</span>
      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs">{costumeLabel ? `服装 ${costumeLabel}` : "未选服装"}</span>
      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs">{faceLabel ? `脸部 ${faceLabel}` : "保持原脸"}</span>
      <div className="ml-auto flex gap-2">
        <Button className="h-9" disabled={running} onClick={onGenerate}>
          {running ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {running ? progress || "正在生成" : "生图"}
        </Button>
        {running ? (
          <Button variant="outline" className="h-9 border-slate-600 bg-transparent text-slate-100 hover:bg-slate-800" onClick={onStop}>
            停止
          </Button>
        ) : null}
      </div>
    </div>
  )
}
