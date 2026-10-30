"use client"

/* eslint-disable @next/next/no-img-element -- history thumbs are local object URLs */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { HistoryEntry } from "@/lib/library"

export type HistoryView = Pick<HistoryEntry, "id" | "createdAt" | "title" | "prompt" | "extraPrompt" | "provider" | "model" | "aspectRatio" | "mode" | "keepOutfit" | "costume" | "selection"> & {
  thumbUrl: string
}

export function HistoryPanel({
  entries,
  onReuse,
  onDelete,
  onClear,
}: {
  entries: HistoryView[]
  onReuse: (entry: HistoryView) => void
  onDelete: (id: string) => void
  onClear: () => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const current = entries.find((entry) => entry.id === openId) ?? null

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">历史</h3>
        {entries.length > 0 ? (
          <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setConfirmClear(true)}>清空</button>
        ) : null}
      </div>
      {entries.length === 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">还没有历史。成功出图后会留在这里，刷新也不会丢。</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {entries.map((entry) => (
            <button key={entry.id} type="button" className="overflow-hidden rounded-lg border bg-card text-left" onClick={() => setOpenId(entry.id)}>
              <img src={entry.thumbUrl} alt={entry.title} className="aspect-[3/4] w-full bg-[#f7f4ee] object-contain" />
              <span className="line-clamp-2 px-1.5 py-1 text-[11px] leading-4">{entry.title}</span>
            </button>
          ))}
        </div>
      )}
      <Dialog open={current !== null} onOpenChange={(open) => { if (!open) setOpenId(null) }}>
        <DialogContent className="max-h-[min(85dvh,85%)] max-w-[min(32rem,calc(100%-2rem))] overflow-y-auto">
          {current ? (
            <>
              <DialogHeader>
                <DialogTitle>{current.title}</DialogTitle>
                <DialogDescription>{new Date(current.createdAt).toLocaleString("zh-CN", { hour12: false })}</DialogDescription>
              </DialogHeader>
              <img src={current.thumbUrl} alt={current.title} className="w-full rounded-xl bg-[#f7f4ee] object-contain" />
              <p className="text-xs leading-5 text-muted-foreground">
                {current.provider} · {current.aspectRatio} · {current.mode === "sheet" ? "拼图" : "逐张"} · {current.costume ? `换成 ${current.costume.id}` : current.keepOutfit ? "保持服装" : "允许换衣服"}
                {current.model ? ` · ${current.model}` : ""}
              </p>
              {current.selection.length > 0 ? (
                <ul className="text-sm leading-6">
                  {current.selection.map((item) => <li key={`${item.poseId}-${item.viewId}`}>{item.title} · {item.angle}</li>)}
                </ul>
              ) : null}
              {current.extraPrompt ? <p className="text-sm leading-6">补充描述：{current.extraPrompt}</p> : null}
              <pre className="max-h-40 overflow-auto rounded-xl bg-muted px-3 py-2 text-xs leading-5 whitespace-pre-wrap">{current.prompt}</pre>
              <div className="flex gap-2">
                <Button type="button" onClick={() => { onReuse(current); setOpenId(null) }}>再用</Button>
                <Button type="button" variant="outline" onClick={() => { onDelete(current.id); setOpenId(null) }}>删除</Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent className="max-w-[min(28rem,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle>清空全部历史</DialogTitle>
            <DialogDescription>这些成图会从这台浏览器删除，不能恢复。</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmClear(false)}>先留着</Button>
            <Button type="button" onClick={() => { setConfirmClear(false); onClear() }}>清空</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
