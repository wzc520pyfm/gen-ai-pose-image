"use client"

/* eslint-disable @next/next/no-img-element -- history thumbs are local object URLs */

import { useState } from "react"
import { Button, Modal } from "@heroui/react"
import type { HistoryEntry } from "@/lib/library"
import { useOverlayPortal } from "@/lib/studio-env"

export type HistoryView = Pick<HistoryEntry, "id" | "createdAt" | "title" | "prompt" | "extraPrompt" | "provider" | "model" | "aspectRatio" | "mode" | "keepOutfit" | "costume" | "face" | "selection"> & {
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
  const portal = useOverlayPortal()
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
              <img src={entry.thumbUrl} alt={entry.title} className="aspect-[3/4] w-full lanzi-paper object-contain" />
              <span className="line-clamp-2 px-1.5 py-1 text-[11px] leading-4">{entry.title}</span>
            </button>
          ))}
        </div>
      )}
      <Modal.Backdrop isOpen={current !== null} onOpenChange={(open) => { if (!open) setOpenId(null) }} {...portal}>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="max-h-[min(85dvh,85%)] max-w-[min(32rem,calc(100%-2rem))]">
            <Modal.CloseTrigger />
            {current ? (
              <>
                <Modal.Header>
                  <Modal.Heading>{current.title}</Modal.Heading>
                  <p className="text-sm text-muted-foreground">{new Date(current.createdAt).toLocaleString("zh-CN", { hour12: false })}</p>
                </Modal.Header>
                <Modal.Body className="grid gap-3">
                  <img src={current.thumbUrl} alt={current.title} className="w-full rounded-xl lanzi-paper object-contain" />
                  <p className="text-xs leading-5 text-muted-foreground">
                    {current.provider} · {current.aspectRatio} · {current.mode === "sheet" ? "拼图" : "逐张"} · {current.face ? `脸部 ${current.face.id}` : "保持原脸"} · {current.costume ? `换成 ${current.costume.id}` : current.keepOutfit ? "保持服装" : "允许换衣服"}
                    {current.model ? ` · ${current.model}` : ""}
                  </p>
                  {current.selection.length > 0 ? (
                    <ul className="text-sm leading-6">
                      {current.selection.map((item) => <li key={`${item.poseId}-${item.viewId}`}>{item.title} · {item.angle}</li>)}
                    </ul>
                  ) : null}
                  {current.extraPrompt ? <p className="text-sm leading-6">补充描述：{current.extraPrompt}</p> : null}
                  <pre className="max-h-40 overflow-auto rounded-xl bg-secondary px-3 py-2 text-xs leading-5 whitespace-pre-wrap">{current.prompt}</pre>
                </Modal.Body>
                <Modal.Footer>
                  <Button type="button" onPress={() => { onReuse(current); setOpenId(null) }}>再用</Button>
                  <Button type="button" variant="outline" onPress={() => { onDelete(current.id); setOpenId(null) }}>删除</Button>
                </Modal.Footer>
              </>
            ) : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <Modal.Backdrop isOpen={confirmClear} onOpenChange={setConfirmClear} {...portal}>
        <Modal.Container>
          <Modal.Dialog className="max-w-[min(28rem,calc(100%-2rem))]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>清空全部历史</Modal.Heading>
              <p className="text-sm text-muted-foreground">这些成图会从这台浏览器删除，不能恢复。</p>
            </Modal.Header>
            <Modal.Footer>
              <Button type="button" variant="outline" onPress={() => setConfirmClear(false)}>先留着</Button>
              <Button type="button" onPress={() => { setConfirmClear(false); onClear() }}>清空</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  )
}
