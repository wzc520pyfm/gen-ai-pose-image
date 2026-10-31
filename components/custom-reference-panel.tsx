"use client"

/* eslint-disable @next/next/no-img-element -- custom references are local object URLs */

import { useEffect, useRef, useState } from "react"
import { useElapsedSeconds, withElapsed } from "@/lib/elapsed"
import { base64ToBlob, fileToJpegBlob } from "@/lib/library"
import { requestBeautify, requestReferenceImage } from "@/lib/reference-client"
import type { StudioSettings } from "@/lib/settings"
import { useStudioEnv } from "@/lib/studio-env"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

export type CustomCard = {
  id: string
  label: string
  keywords: string
  adult: boolean
  thumbUrl: string
}

export type CustomDraft = {
  label: string
  keywords: string
  adult: boolean
  source: "upload" | "generated"
  userPrompt: string
  beautifiedPrompt: string
  blob: Blob
  mediaType: string
}

type DialogMode = "upload" | "freeform" | "describe"

export function CustomReferencePanel({
  kind,
  items,
  hiddenAdult,
  isSelected,
  onToggle,
  onDelete,
  onSave,
  showAdult,
  onRequestAdult,
  settings,
  hasKey,
  syncWarning,
}: {
  kind: "pose" | "costume"
  items: CustomCard[]
  hiddenAdult: number
  isSelected: (id: string) => boolean
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onSave: (draft: CustomDraft) => Promise<void>
  showAdult: boolean
  onRequestAdult: () => void
  settings: StudioSettings
  hasKey: boolean
  syncWarning: string
}) {
  const { basePath } = useStudioEnv()
  const fileRef = useRef<HTMLInputElement>(null)
  const editedRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<DialogMode>("upload")
  const [description, setDescription] = useState("")
  const [prompt, setPrompt] = useState("")
  const [notice, setNotice] = useState("")
  const [adult, setAdult] = useState(false)
  const [label, setLabel] = useState("")
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [busy, setBusy] = useState("")
  const waited = useElapsedSeconds(busy === "正在生成参考图" || busy === "正在扩写提示词")
  const [error, setError] = useState("")
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const noun = kind === "pose" ? "姿势" : "服装"

  useEffect(() => {
    if (!previewBlob) {
      setPreviewUrl("")
      return
    }
    const url = URL.createObjectURL(previewBlob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [previewBlob])

  function resetDialog(next: DialogMode) {
    editedRef.current = false
    setMode(next)
    setDescription("")
    setPrompt("")
    setNotice("")
    setAdult(false)
    setLabel(kind === "pose" ? "自定义姿势" : "自定义服装")
    setPreviewBlob(null)
    setError("")
    setBusy("")
  }

  async function fillPrompt(userPrompt: string, allowAdult: boolean) {
    setBusy("正在扩写提示词")
    setError("")
    const result = await requestBeautify(basePath, settings, {
      kind,
      userPrompt,
      adult: allowAdult,
      hasKey,
    })
    if (!editedRef.current) {
      setPrompt(result.prompt)
      setNotice(result.notice || (result.source === "template" ? "这是本地扩写，可以再改，也可以复制。" : "扩写结果可以再改，然后再生成。"))
    }
    setBusy("")
  }

  function openDialog(next: DialogMode) {
    resetDialog(next)
    setOpen(true)
    if (next === "freeform") void fillPrompt("", false)
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy("正在读取图片")
    setError("")
    try {
      const blob = await fileToJpegBlob(file)
      setPreviewBlob(blob)
      const base = file.name.replace(/\.[^.]+$/, "").trim().slice(0, 80)
      if (base) setLabel(base)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "这张图片读不了")
    } finally {
      setBusy("")
    }
  }

  async function generateImage() {
    const text = prompt.trim()
    if (!text) {
      setError("先写好提示词。没有密钥时也可以复制本地扩写。")
      return
    }
    if (!hasKey) {
      setError(settings.engine === "comfyui"
        ? "没有保存云端密钥，不能生成参考图。先选 Seedream、Gemini 或 OpenAI 填好密钥。提示词仍可复制。"
        : "没有密钥，不能生成参考图。提示词可以复制。")
      return
    }
    setBusy("正在生成参考图")
    setError("")
    try {
      const image = await requestReferenceImage(basePath, settings, text, kind)
      const blob = await fileToJpegBlob(base64ToBlob(image.imageBase64, image.mediaType))
      setPreviewBlob(blob)
      if (!label.trim()) setLabel(description.trim().slice(0, 80) || (kind === "pose" ? "自定义姿势" : "自定义服装"))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "参考图没有生成")
    } finally {
      setBusy("")
    }
  }

  async function save() {
    if (!previewBlob) {
      setError(mode === "upload" ? "先选一张图片。" : "先生成参考图，确认后再保存。")
      return
    }
    const nextLabel = label.trim().slice(0, 80) || (kind === "pose" ? "自定义姿势" : "自定义服装")
    setBusy("正在保存")
    setError("")
    try {
      await onSave({
        label: nextLabel,
        keywords: kind === "costume" ? (description.trim() || nextLabel).slice(0, 300) : nextLabel,
        adult: showAdult && adult,
        source: mode === "upload" ? "upload" : "generated",
        userPrompt: description.trim(),
        beautifiedPrompt: mode === "upload" ? "" : prompt.trim(),
        blob: previewBlob,
        mediaType: "image/jpeg",
      })
      setOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败")
    } finally {
      setBusy("")
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm leading-6 text-muted-foreground">
        {kind === "pose"
          ? "自定义姿势只存在这台浏览器。上传或生成的图会当作姿势参考，出图顺序仍是角色、服装、姿势。"
          : "自定义服装只存在这台浏览器。生成时会做成隐形人穿着的成套衣服，没有头和手。"}
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => openDialog("upload")}>上传</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => openDialog("freeform")}>自由生成</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => openDialog("describe")}>按描述生成</Button>
      </div>
      {syncWarning ? <p className="mb-3 text-sm text-amber-800">{syncWarning}</p> : null}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-4 py-10 text-center">
          <p className="text-sm font-medium">还没有自定义{noun}</p>
          <p className="mt-1 text-sm text-muted-foreground">可以上传一张图，或写一句描述再生成参考图。</p>
          {hiddenAdult > 0 && !showAdult ? (
            <Button className="mt-3" variant="outline" onClick={onRequestAdult}>显示 {hiddenAdult} 张成人向参考</Button>
          ) : null}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 @min-[640px]/studio:grid-cols-3 @min-[1280px]/studio:grid-cols-4 @min-[1536px]/studio:grid-cols-5">
        {items.map((item) => {
          const selected = isSelected(item.id)
          return (
            <article key={item.id} className={`overflow-hidden rounded-xl border bg-card text-left shadow-sm ${selected ? "border-primary ring-2 ring-primary/25" : "border-border"}`}>
              <button type="button" className="block w-full text-left" onClick={() => onToggle(item.id)} aria-pressed={selected}>
                <div className="relative aspect-[3/4] bg-white">
                  {item.thumbUrl ? <img src={item.thumbUrl} alt={item.label} className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center text-xs text-muted-foreground">读取中</div>}
                  {selected ? <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">{kind === "pose" ? "已选" : "换这套"}</span> : null}
                </div>
                <div className="space-y-1 px-3 py-2.5">
                  <p className="line-clamp-2 text-sm font-medium">{item.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.adult ? "成人向 · " : ""}自定义</p>
                </div>
              </button>
              <div className="px-3 pb-3">
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => {
                    if (pendingDelete === item.id) {
                      setPendingDelete(null)
                      onDelete(item.id)
                      return
                    }
                    setPendingDelete(item.id)
                  }}
                >
                  {pendingDelete === item.id ? "确认删除" : "删除"}
                </button>
              </div>
            </article>
          )
        })}
      </div>
      {hiddenAdult > 0 && !showAdult && items.length > 0 ? (
        <Button className="mt-3" variant="outline" onClick={onRequestAdult}>还有 {hiddenAdult} 张成人向参考被收着</Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(85dvh,85%)] max-w-[min(32rem,calc(100%-2rem))] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "upload" ? `上传自定义${noun}` : mode === "freeform" ? `自由生成${noun}参考` : `按描述生成${noun}参考`}</DialogTitle>
            <DialogDescription>
              {kind === "pose"
                ? "姿势参考偏向白底线稿，只表达身体姿态。确认之后才会放进自定义库。"
                : "服装参考偏向隐形穿着的成套造型，没有头、手和皮肤。确认之后才会放进自定义库。"}
            </DialogDescription>
          </DialogHeader>
          {mode === "upload" ? (
            <div className="grid gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                aria-label={`选择${noun}图片`}
                onChange={(event) => void onFile(event.target.files?.[0])}
              />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>选择图片</Button>
            </div>
          ) : null}
          {mode === "describe" ? (
            <label className="grid gap-1.5 text-sm">
              简短描述
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={kind === "pose" ? "例如：单手叉腰，身体微侧" : "例如：米色风衣，腰带，长款"}
                maxLength={2000}
                className="min-h-20 bg-card"
              />
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(busy) || description.trim() === ""}
                onClick={() => {
                  editedRef.current = false
                  void fillPrompt(description, showAdult && adult)
                }}
              >
                {busy === "正在扩写提示词" ? withElapsed(busy, waited) : "扩写提示词"}
              </Button>
            </label>
          ) : null}
          {mode !== "upload" ? (
            <label className="grid gap-1.5 text-sm">
              提示词
              <Textarea
                value={prompt}
                onChange={(event) => {
                  editedRef.current = true
                  setPrompt(event.target.value)
                }}
                maxLength={4000}
                className="min-h-28 bg-card"
              />
            </label>
          ) : null}
          {notice ? <p className="text-xs leading-5 text-muted-foreground">{notice}</p> : null}
          {showAdult ? (
            <label className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-3 text-sm">
              <span>标成成人向参考。默认关闭，未打开成人向时不会用来出图。</span>
              <Switch
                checked={adult}
                onCheckedChange={(value) => {
                  setAdult(value)
                  if (mode !== "upload" && !editedRef.current) void fillPrompt(description, value)
                }}
                aria-label="标成成人向参考"
              />
            </label>
          ) : null}
          {previewUrl ? <img src={previewUrl} alt="参考图预览" className="mx-auto max-h-72 rounded-xl bg-white object-contain" /> : null}
          <label className="grid gap-1.5 text-sm">
            名称
            <Input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} />
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            {mode !== "upload" ? (
              <>
                <Button type="button" variant="outline" disabled={!prompt.trim()} onClick={() => void navigator.clipboard.writeText(prompt)}>复制提示词</Button>
                <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => void generateImage()}>{busy === "正在生成参考图" ? withElapsed(busy, waited) : "生成参考图"}</Button>
              </>
            ) : null}
            <Button type="button" disabled={Boolean(busy) || !previewBlob} onClick={() => void save()}>{busy === "正在保存" ? busy : "保存到自定义"}</Button>
          </div>
          {busy === "正在扩写提示词" && mode === "freeform" ? <p className="text-xs text-muted-foreground">{withElapsed(busy, waited)}</p> : null}
          {busy === "正在读取图片" ? <p className="text-xs text-muted-foreground">{busy}</p> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
