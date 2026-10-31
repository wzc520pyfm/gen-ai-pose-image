"use client"

/* eslint-disable @next/next/no-img-element -- results are data URLs and pose thumbs are proxied */

import { useState } from "react"
import { Download, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { HistoryPanel, type HistoryView } from "@/components/history-panel"
import { Textarea } from "@/components/ui/textarea"
import type { StoredCharacter } from "@/lib/characters"
import type { AspectRatio, GenerateMode, PromptCard } from "@/lib/types"
import { ASPECT_LABEL } from "@/lib/types"
import { studioUrl, useStudioEnv } from "@/lib/studio-env"
import { IDENTITY_REQUIRED } from "@/shared/models.mjs"

export type ResultCard = {
  viewId?: string
  key: string
  title: string
  prompt: string
  ok: boolean
  error?: string
  src?: string
  warning?: string
}

export function Composer({
  localMode = false,
  selected,
  onRemove,
  onClear,
  onRandom,
  characters,
  extraPrompt,
  onExtraPrompt,
  providerLabel,
  aspectRatio,
  mode,
  keepOutfit,
  costume,
  onClearCostume,
  face,
  onClearFace,
  hasKey,
  running,
  progress,
  runError,
  prompts,
  promptError,
  results,
  limitNote,
  onGenerate,
  onStop,
  onOpenSettings,
  history,
  onReuseHistory,
  onDeleteHistory,
  onClearHistory,
  reuseNote,
  builtinName,
  builtinSheet,
  modelSelected = true,
}: {
  localMode?: boolean
  selected: Array<{ poseId: string; viewId: string; title: string; angle: string; thumbSrc?: string }>
  onRemove: (poseId: string) => void
  onClear: () => void
  onRandom: () => void
  characters: StoredCharacter[]
  extraPrompt: string
  onExtraPrompt: (value: string) => void
  providerLabel: string
  aspectRatio: AspectRatio
  mode: GenerateMode
  keepOutfit: boolean
  costume: { id: string; label: string; keywords: string; thumbSrc?: string } | null
  onClearCostume: () => void
  face: { id: string; section: string; hair: string; label: string; keywords: string } | null
  onClearFace: () => void
  hasKey: boolean
  running: boolean
  progress: string
  runError: string
  prompts: PromptCard[]
  promptError: string
  results: ResultCard[]
  limitNote: string
  onGenerate: () => void
  onStop: () => void
  onOpenSettings: () => void
  history: HistoryView[]
  onReuseHistory: (entry: HistoryView) => void
  onDeleteHistory: (id: string) => void
  onClearHistory: () => void
  reuseNote: string
  builtinName: string
  builtinSheet: string
  modelSelected?: boolean
}) {
  const { basePath } = useStudioEnv()
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null)
  const characterSrc = characters[0]
    ? `data:${characters[0].mediaType};base64,${characters[0].dataBase64}`
    : studioUrl(basePath, builtinSheet)
  const limit = mode === "sheet" ? 4 : 8
  const poseThumb = (viewId: string, thumbSrc?: string) => thumbSrc || studioUrl(basePath, `/api/pose-image?id=${encodeURIComponent(viewId)}&size=thumb`)
  const costumeThumb = costume?.thumbSrc || (costume ? studioUrl(basePath, `/api/costume-image?id=${encodeURIComponent(costume.id)}&size=thumb`) : "")
  const faceThumb = face ? studioUrl(basePath, `/api/face-image?id=${encodeURIComponent(face.id)}&size=thumb`) : ""
  const faceCaption = face ? [face.section, face.hair, face.label].filter(Boolean).join(" · ") : ""
  const hasIdentity = modelSelected || Boolean(face)
  const missingPose = selected.length === 0 && !(localMode && costume)
  const openZoom = (src: string, alt: string) => setZoom({ src, alt })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">已选 {selected.length} 个姿势</h2>
          <Button type="button" size="sm" variant="outline" disabled={running} onClick={onRandom}>随机组合</Button>
        </div>
        {selected.length > 0 ? (
          <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={onClear}>清空</button>
        ) : null}
      </div>

      {face ? (
        <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-card px-2 py-1.5">
          <img src={faceThumb} alt="" className="h-14 w-11 rounded-md bg-white object-cover" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">脸部 {face.id}</span>
            <span className="line-clamp-2 text-xs text-muted-foreground">{faceCaption || "脸部参考"}</span>
          </span>
          <button type="button" className="px-1 text-xs text-muted-foreground" onClick={onClearFace} aria-label={`取消脸部 ${face.id}`}>取消</button>
        </div>
      ) : null}

      {costume ? (
        <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-card px-2 py-1.5">
          <img src={costumeThumb} alt="" className="h-14 w-10 rounded-md bg-white object-contain" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">换成 {costume.id}</span>
            <span className="line-clamp-2 text-xs text-muted-foreground">{costume.label} · {costume.keywords}</span>
          </span>
          <button type="button" className="px-1 text-xs text-muted-foreground" onClick={onClearCostume} aria-label={`取消服装 ${costume.id}`}>取消</button>
        </div>
      ) : null}

      {selected.length === 0 && !(localMode && costume) ? (
        <p className="rounded-xl bg-muted px-3 py-4 text-sm leading-6 text-muted-foreground">
          从中间点选一个或多个姿势。{modelSelected
            ? `每一张成图都会带上${characters.length ? "你导入的模特" : builtinName}，只把身体换成对应的线稿姿势。`
            : "这次没有选模特。选一张脸部参考后，可以只按这张脸、服装和姿势出图。"}要换衣服，先到「服装」里点一套。要换脸或表情，先到「脸部」里点一张。
        </p>
      ) : (
        <ul className="flex max-h-40 flex-col gap-2 overflow-auto">
          {selected.map((item) => (
            <li key={item.poseId} className="flex items-center gap-2 rounded-xl border bg-card px-2 py-1.5">
              <img src={poseThumb(item.viewId, item.thumbSrc)} alt="" className="h-12 w-9 rounded-md bg-white object-contain" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.angle}</span>
              </span>
              <button type="button" className="px-1 text-xs text-muted-foreground" onClick={() => onRemove(item.poseId)} aria-label={`去掉 ${item.title}`}>去掉</button>
            </li>
          ))}
        </ul>
      )}

      {selected[0] ? (
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">参考对照 · {selected[0].title}</p>
          <div className={`mt-2 grid items-center gap-2 ${referenceColumns(modelSelected, Boolean(face), Boolean(costume))}`}>
            {modelSelected ? (
              <ZoomThumb src={characterSrc} alt={characters.length ? "导入的模特" : `${builtinName}的多视角设定图`} className="aspect-[3/4] rounded-lg bg-[#f8fafc] object-contain" onZoom={openZoom} />
            ) : null}
            {face ? (
              <ZoomThumb src={faceThumb} alt={`${face.id} 的脸部参考，只取五官、表情和发型`} className="aspect-[3/4] rounded-lg bg-white object-cover" onZoom={openZoom} />
            ) : null}
            {costume ? (
              <ZoomThumb src={costumeThumb} alt={`${costume.id} 的服装参考，图中没有人物`} className="aspect-[3/4] rounded-lg bg-white object-contain" onZoom={openZoom} />
            ) : modelSelected && !face ? (
              <span className="text-lg text-muted-foreground" aria-hidden="true">→</span>
            ) : null}
            <ZoomThumb src={poseThumb(selected[0].viewId, selected[0].thumbSrc)} alt={`${selected[0].title} 的姿势线稿`} className="aspect-[3/4] rounded-lg bg-white object-contain" onZoom={openZoom} />
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {referenceCaption(Boolean(face), Boolean(costume), modelSelected)}
          </p>
        </div>
      ) : costume ? (
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">已选服装 · {costume.id}</p>
          <ZoomThumb src={costumeThumb} alt={`${costume.id}，${costume.keywords}`} className="mt-2 aspect-[2/3] max-h-48 rounded-lg bg-white object-contain" onZoom={openZoom} />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{!modelSelected && !face ? "还没选模特。选一张脸部参考后，可以不带模特换衣服出图。" : localMode ? "未选择姿势，将保留人物原姿势，只更换服装。" : "还没选姿势。选好姿势后，角色会穿上这套衣服出图。"}</p>
        </div>
      ) : null}

      {prompts.length > 0 ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">提示词预览</h3>
            <button
              type="button"
              className="text-xs text-primary"
              onClick={() => void navigator.clipboard.writeText(prompts.map((item) => `${item.title}\n${item.prompt}`).join("\n\n"))}
            >
              复制全部
            </button>
          </div>
          {prompts.map((item) => (
            <details key={item.viewId} className="rounded-xl bg-muted/70 px-3 py-2">
              <summary className="cursor-pointer text-sm">{item.title}</summary>
              <pre className="mt-2 max-h-48 overflow-auto text-xs leading-5 whitespace-pre-wrap">{item.prompt}</pre>
            </details>
          ))}
        </div>
      ) : null}
      {promptError ? <p className="text-xs text-destructive">{promptError}</p> : null}

      <label className="grid gap-1.5 text-sm">
        补充描述
        <Textarea
          value={extraPrompt}
          onChange={(event) => onExtraPrompt(event.target.value)}
          placeholder="例如：海边黄昏，风吹起外套。不写也可以。"
          maxLength={2000}
          className="min-h-20 bg-card"
        />
      </label>

      <p className="text-xs leading-5 text-muted-foreground">
        {providerLabel} · {ASPECT_LABEL[aspectRatio]} · {mode === "sheet" ? `拼成一张（最多 ${limit} 个）` : `逐张出图（最多 ${limit} 张）`} · {face ? `脸部 ${face.id}` : "保持原脸"} · {costume ? `换成 ${costume.id}` : keepOutfit ? "保持服装" : "允许换衣服"}
        {" · "}
        <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={onOpenSettings}>改设置</button>
      </p>
      {limitNote ? <p className="text-sm text-amber-800">{limitNote}</p> : null}
      {selected.length > limit ? <p className="text-sm text-amber-800">当前方式一次最多 {limit} 个姿势。</p> : null}

      {!hasIdentity ? <p className="text-sm text-amber-800">{IDENTITY_REQUIRED}</p> : null}
      <div className="flex gap-2">
        <Button className="h-11 flex-1" disabled={running || !hasIdentity || missingPose || selected.length > limit} onClick={onGenerate}>
          {running ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {running ? progress || "正在生图" : hasKey ? (localMode && selected.length === 0 ? "仅换装生图" : "按所选姿势生图") : "填写密钥后生图"}
        </Button>
        {running ? <Button variant="outline" className="h-11" onClick={onStop}>停止</Button> : null}
      </div>
      {!hasKey ? <p className="text-xs leading-5 text-muted-foreground">密钥只留在这台浏览器里。没有密钥时，下面的提示词仍然可以复制到 dsh-image-gen 里用。</p> : null}
      {reuseNote ? <p className="text-sm text-primary">{reuseNote}</p> : null}
      {runError ? <p className="text-sm text-destructive">{runError}</p> : null}

      {results.length > 0 ? (
        <div className="grid gap-3">
          <h3 className="text-sm font-medium">成图</h3>
          {results.map((item) => (
            <article key={item.key} className="overflow-hidden rounded-xl border bg-card">
              {item.ok && item.src ? (
                <button type="button" className="relative block w-full cursor-zoom-in" onClick={() => openZoom(item.src || "", item.title)} aria-label={`放大成图 ${item.title}`}>
                  <img src={item.src} alt={item.title} className="w-full bg-[#f7f4ee] object-contain" />
                  <span className="pointer-events-none absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">放大</span>
                </button>
              ) : null}
              <div className="space-y-2 px-3 py-3">
                <p className="text-sm font-medium">{item.title}</p>
                {item.error ? <p className="text-sm text-destructive">{item.error}</p> : null}
                {item.warning ? <p className="text-xs leading-5 text-amber-800">{item.warning}</p> : null}
                {item.src ? (
                  <a className="inline-flex items-center gap-1 text-sm text-primary" href={item.src} download={`${item.title}.png`}>
                    <Download className="size-4" />
                    下载
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
      <HistoryPanel entries={history} onReuse={onReuseHistory} onDelete={onDeleteHistory} onClear={onClearHistory} />
      <Dialog open={zoom !== null} onOpenChange={(open) => { if (!open) setZoom(null) }}>
        <DialogContent className="max-h-[min(92dvh,92%)] max-w-[min(72rem,calc(100%-2rem))] overflow-y-auto">
          {zoom ? (
            <>
              <DialogHeader>
                <DialogTitle>{zoom.alt}</DialogTitle>
                <DialogDescription>点击外面或按 Esc 关闭。</DialogDescription>
              </DialogHeader>
              <img src={zoom.src} alt={zoom.alt} className="max-h-[78dvh] w-full rounded-xl bg-[#f7f4ee] object-contain" />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ZoomThumb({
  src,
  alt,
  className,
  onZoom,
}: {
  src: string
  alt: string
  className: string
  onZoom: (src: string, alt: string) => void
}) {
  return (
    <button type="button" className="block w-full cursor-zoom-in" onClick={() => onZoom(src, alt)} aria-label={`放大 ${alt}`}>
      <img src={src} alt={alt} className={className} />
    </button>
  )
}

function referenceColumns(hasCharacter: boolean, hasFace: boolean, hasCostume: boolean) {
  if (hasCharacter && !hasFace && !hasCostume) return "grid-cols-[1fr_auto_1fr]"
  const count = Number(hasCharacter) + Number(hasFace) + Number(hasCostume) + 1
  if (count >= 4) return "grid-cols-4"
  if (count === 3) return "grid-cols-3"
  if (count === 2) return "grid-cols-2"
  return "grid-cols-1"
}

function referenceCaption(hasFace: boolean, hasCostume: boolean, hasCharacter: boolean) {
  if (!hasCharacter && hasFace && hasCostume) return "顺序是脸部参考、没有人物的衣服、姿势线稿。没有角色设定图，身份以这张脸为准。这还不是成图。"
  if (!hasCharacter && hasFace) return "左边是脸部参考，右边只提供姿势。没有角色设定图，身份以这张脸为准。这还不是成图。"
  if (!hasCharacter) return "还没选模特。选一张脸部参考后可以出图，也可以改回一位模特。这还不是成图。"
  if (hasFace && hasCostume) return "顺序是角色、脸部参考、没有人物的衣服、姿势线稿。脸部图只提供五官、表情和发型。这还不是成图。"
  if (hasFace) return "左边是角色，中间这张脸提供五官、表情和发型，右边只提供姿势。衣服仍按角色参考。这还不是成图。"
  if (hasCostume) return "左边锁脸和鲸尾，中间是没有人物的衣服，右边只提供姿势。这还不是成图。"
  return "左边锁脸和衣服，右边只提供姿势。这还不是成图。"
}
