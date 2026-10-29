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
  outfitLocked = false,
}: {
  images: StoredCharacter[]
  onChange: (images: StoredCharacter[]) => void
  keepOutfit: boolean
  onKeepOutfit: (value: boolean) => void
  outfitLocked?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const custom = images.length > 0
  const portrait = custom ? `data:${images[0].mediaType};base64,${images[0].dataBase64}` : "/muse/dafeiyu-portrait.jpg"
  const full = custom ? portrait : "/muse/dafeiyu-sheet.png"

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
    <aside className="dock order-1 flex shrink-0 flex-col gap-3 px-3 py-3 text-[#e2e8f0] lg:order-none lg:h-full lg:min-h-0 lg:shrink lg:gap-4 lg:overflow-y-auto lg:px-4 lg:py-5">
      <div className="flex items-center gap-3">
        <img src={portrait} alt="" className="size-14 shrink-0 rounded-xl object-cover object-top lg:hidden" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white lg:text-2xl">{custom ? "导入的模特" : "大肥鱼"}</h2>
          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[#cbd5e1] lg:mt-2 lg:text-sm lg:leading-6">{custom ? "生图时改用你导入的参考图。" : "社区鲸鱼娘的成年形象，不是 DeepSeek 官方吉祥物。"}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white lg:hidden"
          disabled={busy || images.length >= 3}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus />
          {busy ? "读图" : "导入"}
        </Button>
      </div>
      <img src={portrait} alt={custom ? "导入的模特头像" : "大肥鱼的正面全身像，蓝发、鲸耳、蓝白女仆装"} className="hidden aspect-[3/4] w-full rounded-xl object-cover object-top lg:block" />
      <p className="hidden text-sm leading-6 text-[#cbd5e1] lg:block">
        {custom
          ? "参考图会和姿势线稿一起交给模型。请使用成年人物的图片。"
          : "长波浪蓝发、鲸耳和蓝鲸尾。三视图锁住脸和鲸尾，衣服可以换成衣装集里的一套。"}
      </p>
      {!custom ? (
        <img src={full} alt="大肥鱼的成年三视图：正面、侧面、背面，以及头饰和裙摆细节" className="hidden max-h-56 rounded-xl bg-white object-contain lg:block" />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {images.map((image) => (
            <div key={image.id} className="relative">
              <img src={`data:${image.mediaType};base64,${image.dataBase64}`} alt="导入的模特参考" className="aspect-[3/4] w-full rounded-lg object-cover" />
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
        className="hidden border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white lg:inline-flex"
        disabled={busy || images.length >= 3}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus />
        {busy ? "正在读图" : images.length ? "再加一张参考" : "导入其他模特"}
      </Button>
      {custom ? (
        <Button variant="ghost" className="text-[#e2e8f0] hover:bg-white/10 hover:text-white" onClick={() => onChange([])}>
          <RotateCcw />
          恢复默认模特大肥鱼
        </Button>
      ) : null}
      {error ? <p className="text-sm text-[#fecaca]">{error}</p> : null}
      <label className="mt-auto flex items-center justify-between gap-3 rounded-xl bg-white/10 px-3 py-2.5 text-sm lg:py-3">
        <span className="min-w-0">
          <span className="block text-white">保持服装</span>
          <span className="mt-1 block text-xs leading-5 text-[#cbd5e1] sm:hidden">
            {outfitLocked ? "已选服装优先，这个开关先让位。" : "只借姿势，不借线稿里的身体。"}
          </span>
          <span className="mt-1 hidden text-xs leading-5 text-[#cbd5e1] sm:block">
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
