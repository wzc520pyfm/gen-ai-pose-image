"use client"

/* eslint-disable @next/next/no-img-element -- model photos are data URLs or the bundled muse file */

import { useRef, useState } from "react"
import { ImagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { fileToCharacter, type StoredCharacter } from "@/lib/characters"
import { studioUrl, useStudioEnv } from "@/lib/studio-env"
import { withUploadedSheet } from "@/shared/models.mjs"

export type ModelSwitchItem = {
  id: string
  label: string
  builtin: boolean
  thumbSrc: string
}

export function CharacterDock({
  images,
  onChange,
  keepOutfit,
  onKeepOutfit,
  outfitLocked = false,
  switchItems,
  activeModelId,
  activeLabel,
  onSelectModel,
  onRenameModel,
  onDeleteModel,
  onGenerateSheet,
  sheetBusy,
  sheetError,
  hasKey,
  onOpenSettings,
}: {
  images: StoredCharacter[]
  onChange: (images: StoredCharacter[]) => void
  keepOutfit: boolean
  onKeepOutfit: (value: boolean) => void
  outfitLocked?: boolean
  switchItems: ModelSwitchItem[]
  activeModelId: string
  activeLabel: string
  onSelectModel: (id: string) => void
  onRenameModel: (id: string, label: string) => void
  onDeleteModel: (id: string) => void
  onGenerateSheet: () => void
  sheetBusy: boolean
  sheetError: string
  hasKey: boolean
  onOpenSettings: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const sheetInputRef = useRef<HTMLInputElement>(null)
  const { basePath } = useStudioEnv()
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftLabel, setDraftLabel] = useState("")
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const custom = images.length > 0
  const photoCount = images.filter((image) => image.role !== "sheet").length
  const portrait = custom ? `data:${images[0].mediaType};base64,${images[0].dataBase64}` : studioUrl(basePath, "/muse/dafeiyu-portrait.jpg")
  const full = custom ? portrait : studioUrl(basePath, "/muse/dafeiyu-sheet.png")

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    setBusy(true)
    setError("")
    try {
      const next = [...images]
      for (const file of Array.from(list)) {
        if (next.filter((image) => image.role !== "sheet").length >= 3) break
        if (!file.type.startsWith("image/")) continue
        next.push(await fileToCharacter(file))
      }
      if (next.length === images.length) setError("没有读到可用的图片")
      else onChange(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "图片导入失败")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function addSheet(list: FileList | null) {
    const file = list?.[0]
    if (!file) return
    setBusy(true)
    setError("")
    try {
      if (!file.type.startsWith("image/")) throw new Error("这张图片读不了")
      const image = await fileToCharacter(file)
      onChange(withUploadedSheet(images, { ...image, role: "sheet" }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "设定图导入失败")
    } finally {
      setBusy(false)
      if (sheetInputRef.current) sheetInputRef.current.value = ""
    }
  }

  return (
    <aside className="dock order-1 flex shrink-0 flex-col gap-3 px-3 py-3 text-[#e2e8f0] @min-[1024px]/studio:order-none @min-[1024px]/studio:h-full @min-[1024px]/studio:min-h-0 @min-[1024px]/studio:shrink @min-[1024px]/studio:gap-4 @min-[1024px]/studio:overflow-y-auto @min-[1024px]/studio:px-4 @min-[1024px]/studio:py-5">
      <div className="flex items-center gap-3">
        <img src={portrait} alt="" className="size-14 shrink-0 rounded-xl object-cover object-top @min-[1024px]/studio:hidden" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white @min-[1024px]/studio:text-2xl">{custom ? (activeLabel || "导入的模特") : "大肥鱼"}</h2>
          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[#cbd5e1] @min-[1024px]/studio:mt-2 @min-[1024px]/studio:text-sm @min-[1024px]/studio:leading-6">{custom ? "生图时改用你导入的参考图。" : "社区鲸鱼娘的成年形象，不是 DeepSeek 官方吉祥物。"}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white @min-[1024px]/studio:hidden"
          disabled={busy || sheetBusy || photoCount >= 3}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus />
          {busy ? "读图" : "导入"}
        </Button>
      </div>
      <div className="grid max-h-40 gap-2 overflow-y-auto" role="listbox" aria-label="模特">
        <p className="text-xs text-[#cbd5e1]">模特</p>
        {switchItems.map((model) => {
          const selected = model.id === activeModelId
          return (
            <div key={model.id} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${selected ? "bg-white/15 ring-1 ring-white/30" : "bg-white/5"}`}>
              <img src={model.thumbSrc} alt="" className={`h-10 w-8 shrink-0 rounded-md bg-white ${model.builtin ? "object-cover object-top" : "object-contain"}`} />
              {editingId === model.id ? (
                <Input
                  value={draftLabel}
                  aria-label={`模特名称 ${model.label}`}
                  className="h-8 border-white/20 bg-white/10 text-white"
                  onChange={(event) => setDraftLabel(event.target.value)}
                  onBlur={() => {
                    onRenameModel(model.id, draftLabel)
                    setEditingId(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") (event.target as HTMLInputElement).blur()
                  }}
                />
              ) : (
                <button type="button" role="option" aria-selected={selected} className="min-w-0 flex-1 truncate text-left text-sm text-white" onClick={() => onSelectModel(model.id)}>
                  {model.label}
                </button>
              )}
              {model.builtin ? <span className="shrink-0 text-[11px] text-[#cbd5e1]">内置</span> : (
                <>
                  <button type="button" className="shrink-0 text-[11px] text-[#cbd5e1]" onClick={() => { setEditingId(model.id); setDraftLabel(model.label) }}>改名</button>
                  <button
                    type="button"
                    className="shrink-0 text-[11px] text-[#cbd5e1]"
                    onClick={() => {
                      if (pendingDelete === model.id) {
                        setPendingDelete(null)
                        onDeleteModel(model.id)
                        return
                      }
                      setPendingDelete(model.id)
                    }}
                  >
                    {pendingDelete === model.id ? "确认" : "删除"}
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>
      <img src={portrait} alt={custom ? (images[0]?.role === "sheet" ? "多视角设定图" : "导入的模特头像") : "大肥鱼的正面全身像，蓝发、鲸耳、蓝白女仆装"} className={`hidden w-full rounded-xl @min-[1024px]/studio:block ${images[0]?.role === "sheet" ? "max-h-56 bg-white object-contain" : "aspect-[3/4] object-cover object-top"}`} />
      <p className="hidden text-sm leading-6 text-[#cbd5e1] @min-[1024px]/studio:block">
        {custom
          ? "参考图会和姿势线稿一起交给模型。请使用成年人物的图片。"
          : "长波浪蓝发、鲸耳和蓝鲸尾。三视图锁住脸和鲸尾，衣服可以换成衣装集里的一套。"}
      </p>
      {!custom ? (
        <img src={full} alt="大肥鱼的成年三视图：正面、侧面、背面，以及头饰和裙摆细节" className="hidden max-h-56 rounded-xl bg-white object-contain @min-[1024px]/studio:block" />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((image) => (
            <div key={image.id} className="relative">
              <img src={`data:${image.mediaType};base64,${image.dataBase64}`} alt={image.role === "sheet" ? "多视角设定图" : "导入的模特参考"} className={`aspect-[3/4] w-full rounded-lg ${image.role === "sheet" ? "bg-white object-contain" : "object-cover"}`} />
              {image.role === "sheet" ? <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 text-[10px] text-white">设定图</span> : null}
              <button
                type="button"
                className="absolute top-1 right-1 rounded-full bg-black/60 px-1.5 text-[10px] text-white"
                onClick={() => onChange(images.filter((item) => item.id !== image.id))}
              >
                移除
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        aria-label="导入模特照片"
        className="sr-only"
        onChange={(event) => void addFiles(event.target.files)}
      />
      <input
        ref={sheetInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="导入设定图"
        className="sr-only"
        onChange={(event) => void addSheet(event.target.files)}
      />
      <Button
        variant="outline"
        className="hidden border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white @min-[1024px]/studio:inline-flex"
        disabled={busy || sheetBusy || photoCount >= 3}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus />
        {busy ? "正在读图" : images.length ? "再加一张参考" : "导入其他模特"}
      </Button>
      <Button
        variant="outline"
        className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
        disabled={busy || sheetBusy}
        onClick={() => sheetInputRef.current?.click()}
      >
        {busy ? "正在读图" : "导入设定图"}
      </Button>
      <p className="text-xs leading-5 text-[#cbd5e1]">已有完整多视角图时直接导入，会当作当前模特的设定图。只有照片时再生成。</p>
      {photoCount > 0 ? (
        <Button
          variant="outline"
          className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
          disabled={sheetBusy}
          onClick={() => {
            if (!hasKey) {
              onOpenSettings()
              return
            }
            onGenerateSheet()
          }}
        >
          {sheetBusy ? "正在生成" : "生成多视角 sheet"}
        </Button>
      ) : null}
      {sheetError ? <p className="text-sm text-[#fecaca]">{sheetError}</p> : null}
      {error ? <p className="text-sm text-[#fecaca]">{error}</p> : null}
      <label className="mt-auto flex items-center justify-between gap-3 rounded-xl bg-white/10 px-3 py-2.5 text-sm @min-[1024px]/studio:py-3">
        <span className="min-w-0">
          <span className="block text-white">保持服装</span>
          <span className="mt-1 block text-xs leading-5 text-[#cbd5e1] @min-[640px]/studio:hidden">
            {outfitLocked ? "已选服装优先，这个开关先让位。" : "只借姿势，不借线稿里的身体。"}
          </span>
          <span className="mt-1 hidden text-xs leading-5 text-[#cbd5e1] @min-[640px]/studio:block">
            {outfitLocked
              ? "已经选了一套衣服，生图会换成它。取消这套之后，这里的开关重新生效。"
              : "只借姿势，不借线稿里的身体。关掉后可在补充描述里换衣服。"}
          </span>
        </span>
        <Switch checked={outfitLocked ? false : keepOutfit} onCheckedChange={onKeepOutfit} disabled={outfitLocked} aria-label="保持服装" />
      </label>
    </aside>
  )
}
