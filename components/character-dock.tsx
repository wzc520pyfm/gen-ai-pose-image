"use client"

/* eslint-disable @next/next/no-img-element -- model photos are data URLs or the bundled muse file */

import { useRef, useState } from "react"
import { ImagePlus, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { fileToCharacter, type StoredCharacter } from "@/lib/characters"

export function CharacterDock({
  images,
  onChange,
  keepOutfit,
  onKeepOutfit,
}: {
  images: StoredCharacter[]
  onChange: (images: StoredCharacter[]) => void
  keepOutfit: boolean
  onKeepOutfit: (value: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const custom = images.length > 0
  const portrait = custom ? `data:${images[0].mediaType};base64,${images[0].dataBase64}` : "/muse/lan-portrait.jpg"
  const full = custom ? portrait : "/muse/lan-full.jpg"

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    setBusy(true)
    setError("")
    try {
      const next = [...images]
      for (const file of Array.from(list)) {
        if (next.length >= 3) break
        if (!file.type.startsWith("image/")) continue
        next.push(await fileToCharacter(file))
      }
      if (next.length === images.length) setError("没有读到可用的图片")
      else onChange(next.slice(0, 3))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "图片导入失败")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <aside className="dock flex min-h-0 flex-col gap-4 px-4 py-5 text-[#e7eefc] lg:h-full lg:overflow-y-auto">
      <div>
        <p className="text-[11px] tracking-[0.22em] text-[#9fb4d8]">默认模特</p>
        <h2 className="font-display mt-1 text-3xl text-white">{custom ? "导入的模特" : "澜"}</h2>
        <p className="mt-1 text-sm text-[#b7c6e2]">{custom ? "生图时改用你导入的参考图。" : "按 DeepSeek 蓝白配色原创绘制的成年形象，不是官方吉祥物。"}</p>
      </div>
      <div className="overflow-hidden rounded-3xl bg-white/10 ring-1 ring-white/15">
        <img src={portrait} alt={custom ? "导入的模特头像" : "澜的肖像，墨蓝长发，鲸鱼发夹，白色外套"} className="aspect-square w-full object-cover object-top" />
      </div>
      <p className="text-sm leading-6 text-[#d5e0f5]">
        {custom
          ? "参考图会和姿势线稿一起交给模型。请使用成年人物的图片。"
          : "墨蓝长发，一缕青色挑染，蓝色鲸鱼发夹。白色短西装、钴蓝高领、藏青色西裤。全身参考图会一起送去生图，用来锁住脸和衣服。"}
      </p>
      {!custom ? (
        <img src={full} alt="澜的全身参考：白色短西装、钴蓝高领、藏青色西裤" className="max-h-72 rounded-2xl bg-[#f4f1ea] object-contain" />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((image) => (
            <div key={image.id} className="relative">
              <img src={`data:${image.mediaType};base64,${image.dataBase64}`} alt="导入的模特参考" className="aspect-[3/4] w-full rounded-xl object-cover" />
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
        className="sr-only"
        onChange={(event) => void addFiles(event.target.files)}
      />
      <Button
        variant="outline"
        className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
        disabled={busy || images.length >= 3}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus />
        {busy ? "正在读图" : images.length ? "再加一张参考" : "导入其他模特"}
      </Button>
      {custom ? (
        <Button variant="ghost" className="text-[#d5e0f5] hover:bg-white/10 hover:text-white" onClick={() => onChange([])}>
          <RotateCcw />
          恢复默认模特澜
        </Button>
      ) : null}
      {error ? <p className="text-sm text-[#fecaca]">{error}</p> : null}
      <label className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-3 py-3 text-sm">
        <span>
          <span className="block text-white">保持服装</span>
          <span className="mt-0.5 block text-xs leading-5 text-[#b7c6e2]">只借姿势，不借线稿里的身体。关掉后可在补充描述里换衣服。</span>
        </span>
        <Switch checked={keepOutfit} onCheckedChange={onKeepOutfit} aria-label="保持服装" />
      </label>
    </aside>
  )
}
