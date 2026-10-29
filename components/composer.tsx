"use client"

/* eslint-disable @next/next/no-img-element -- results are data URLs and pose thumbs are proxied */

import { Download, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { StoredCharacter } from "@/lib/characters"
import type { AspectRatio, GenerateMode, PromptCard } from "@/lib/types"
import { ASPECT_LABEL } from "@/lib/types"

export type ResultCard = {
  key: string
  title: string
  prompt: string
  ok: boolean
  error?: string
  src?: string
  warning?: string
}

export function Composer({
  selected,
  onRemove,
  onClear,
  characters,
  extraPrompt,
  onExtraPrompt,
  providerLabel,
  aspectRatio,
  mode,
  keepOutfit,
  costume,
  onClearCostume,
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
}: {
  selected: Array<{ poseId: string; viewId: string; title: string; angle: string }>
  onRemove: (poseId: string) => void
  onClear: () => void
  characters: StoredCharacter[]
  extraPrompt: string
  onExtraPrompt: (value: string) => void
  providerLabel: string
  aspectRatio: AspectRatio
  mode: GenerateMode
  keepOutfit: boolean
  costume: { id: string; label: string; keywords: string } | null
  onClearCostume: () => void
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
}) {
  const characterSrc = characters[0]
    ? `data:${characters[0].mediaType};base64,${characters[0].dataBase64}`
    : "/muse/dafeiyu-sheet.png"
  const limit = mode === "sheet" ? 4 : 8

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">已选 {selected.length} 个姿势</h2>
        </div>
        {selected.length > 0 ? (
          <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={onClear}>清空</button>
        ) : null}
      </div>

      {costume ? (
        <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-card px-2 py-1.5">
          <img src={`/api/costume-image?id=${encodeURIComponent(costume.id)}&size=thumb`} alt="" className="h-14 w-10 rounded-md bg-white object-contain" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">换成 {costume.id}</span>
            <span className="line-clamp-2 text-xs text-muted-foreground">{costume.label} · {costume.keywords}</span>
          </span>
          <button type="button" className="px-1 text-xs text-muted-foreground" onClick={onClearCostume} aria-label={`取消服装 ${costume.id}`}>取消</button>
        </div>
      ) : null}

      {selected.length === 0 ? (
        <p className="rounded-xl bg-muted px-3 py-4 text-sm leading-6 text-muted-foreground">
          从中间点选一个或多个姿势。每一张成图都会带上{characters.length ? "你导入的模特" : "大肥鱼"}，只把身体换成对应的线稿姿势。要换衣服，先到「服装」里点一套。
        </p>
      ) : (
        <ul className="flex max-h-40 flex-col gap-2 overflow-auto">
          {selected.map((item) => (
            <li key={item.poseId} className="flex items-center gap-2 rounded-xl border bg-card px-2 py-1.5">
              <img src={`/api/pose-image?id=${encodeURIComponent(item.viewId)}&size=thumb`} alt="" className="h-12 w-9 rounded-md bg-white object-contain" />
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
          <div className={`mt-2 grid items-center gap-2 ${costume ? "grid-cols-3" : "grid-cols-[1fr_auto_1fr]"}`}>
            <img src={characterSrc} alt={characters.length ? "导入的模特" : "大肥鱼的成年三视图"} className="aspect-[3/4] rounded-lg bg-[#f8fafc] object-contain" />
            {costume ? (
              <img src={`/api/costume-image?id=${encodeURIComponent(costume.id)}&size=thumb`} alt={`${costume.id} 的服装参考，图中没有人物`} className="aspect-[3/4] rounded-lg bg-white object-contain" />
            ) : (
              <span className="text-lg text-muted-foreground" aria-hidden="true">→</span>
            )}
            <img src={`/api/pose-image?id=${encodeURIComponent(selected[0].viewId)}&size=thumb`} alt={`${selected[0].title} 的姿势线稿`} className="aspect-[3/4] rounded-lg bg-white object-contain" />
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {costume ? "左边锁脸和鲸尾，中间是没有人物的衣服，右边只提供姿势。这还不是成图。" : "左边锁脸和衣服，右边只提供姿势。这还不是成图。"}
          </p>
        </div>
      ) : costume ? (
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">已选服装 · {costume.id}</p>
          <img src={`/api/costume-image?id=${encodeURIComponent(costume.id)}&size=thumb`} alt={`${costume.id}，${costume.keywords}`} className="mt-2 aspect-[2/3] max-h-48 rounded-lg bg-white object-contain" />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">还没选姿势。选好姿势后，角色会穿上这套衣服出图。</p>
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
        {providerLabel} · {ASPECT_LABEL[aspectRatio]} · {mode === "sheet" ? `拼成一张（最多 ${limit} 个）` : `逐张出图（最多 ${limit} 张）`} · {costume ? `换成 ${costume.id}` : keepOutfit ? "保持服装" : "允许换衣服"}
        {" · "}
        <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={onOpenSettings}>改设置</button>
      </p>
      {limitNote ? <p className="text-sm text-amber-800">{limitNote}</p> : null}
      {selected.length > limit ? <p className="text-sm text-amber-800">当前方式一次最多 {limit} 个姿势。</p> : null}

      <div className="flex gap-2">
        <Button className="h-11 flex-1" disabled={running || selected.length === 0 || selected.length > limit} onClick={onGenerate}>
          {running ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {running ? progress || "正在生图" : hasKey ? "按所选姿势生图" : "填写密钥后生图"}
        </Button>
        {running ? <Button variant="outline" className="h-11" onClick={onStop}>停止</Button> : null}
      </div>
      {!hasKey ? <p className="text-xs leading-5 text-muted-foreground">密钥只留在这台浏览器里。没有密钥时，下面的提示词仍然可以复制到 dsh-image-gen 里用。</p> : null}
      {runError ? <p className="text-sm text-destructive">{runError}</p> : null}

      {results.length > 0 ? (
        <div className="grid gap-3">
          <h3 className="text-sm font-medium">成图</h3>
          {results.map((item) => (
            <article key={item.key} className="overflow-hidden rounded-xl border bg-card">
              {item.ok && item.src ? <img src={item.src} alt={item.title} className="w-full bg-[#f7f4ee] object-contain" /> : null}
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
    </div>
  )
}
