"use client"

/* eslint-disable @next/next/no-img-element -- costume references are proxied webp files */

import { useEffect, useMemo, useState } from "react"
import { Search, X } from "lucide-react"
import { CustomReferencePanel, type CustomCard, type CustomDraft } from "@/components/custom-reference-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { StudioSettings } from "@/lib/settings"
import { studioUrl, useStudioEnv } from "@/lib/studio-env"

type Costume = {
  id: string
  category: string
  label: string
  keywords: string
  adult: boolean
  thumb: string
}

type CostumeCategory = {
  id: string
  label: string
  count: number
  adult: boolean
}

type CostumeCatalog = {
  total: number
  attribution: string
  categories: CostumeCategory[]
  costumes: Costume[]
}

export function CostumeBrowser({
  showAdult,
  focusCategory,
  onFocusApplied,
  onRequestAdult,
  selectedId,
  onSelect,
  customCostumes,
  onSaveCustom,
  onDeleteCustom,
  settings,
  hasKey,
  syncWarning,
  onChangeSettings,
}: {
  showAdult: boolean
  focusCategory: string | null
  onFocusApplied: () => void
  onRequestAdult: (categoryId: string) => void
  selectedId: string | null
  onSelect: (costume: Costume) => void
  customCostumes: CustomCard[]
  onSaveCustom: (draft: CustomDraft) => Promise<void>
  onDeleteCustom: (id: string) => void
  settings: StudioSettings
  hasKey: boolean
  syncWarning: string
  onChangeSettings: (settings: StudioSettings) => void
}) {
  const { basePath } = useStudioEnv()
  const [catalog, setCatalog] = useState<CostumeCatalog | null>(null)
  const [error, setError] = useState("")
  const [category, setCategory] = useState("春")
  const customSection = category === "custom"
  const visibleCustom = customCostumes.filter((item) => showAdult || !item.adult)
  const hiddenCustomAdult = customCostumes.length - visibleCustom.length
  const [query, setQuery] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    fetch(studioUrl(basePath, "/api/costumes"), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("服装目录没有加载出来")
        return response.json() as Promise<CostumeCatalog>
      })
      .then(setCatalog)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return
        setError(cause instanceof Error ? cause.message : "服装目录没有加载出来")
      })
    return () => controller.abort()
  }, [basePath])

  useEffect(() => {
    if (!focusCategory || !showAdult) return
    setCategory(focusCategory)
    onFocusApplied()
  }, [focusCategory, showAdult, onFocusApplied])

  const costumes = useMemo(() => {
    if (!catalog) return []
    const parts = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return catalog.costumes.filter((costume) => {
      if (!showAdult && costume.adult) return false
      if (costume.category !== category) return false
      if (!parts.length) return true
      const hay = `${costume.id} ${costume.keywords} ${costume.label}`.toLowerCase()
      return parts.every((part) => hay.includes(part))
    })
  }, [catalog, category, query, showAdult])

  return (
    <section>
      <div className="sticky top-0 z-10 border-b bg-white/95 px-4 py-3 backdrop-blur @min-[768px]/studio:px-6">
        <p className="mb-2 text-sm text-muted-foreground">这些图里没有人物。选一套之后，大肥鱼会换上这身衣服，脸、头发、鲸耳和鲸尾保持不变。</p>
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("custom")}
            className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${customSection ? "bg-primary text-primary-foreground" : "bg-white ring-1 ring-border"}`}
          >
            自定义
            <span className={`ml-1.5 text-xs ${customSection ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{visibleCustom.length}</span>
          </button>
          {catalog?.categories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.adult && !showAdult) {
                  onRequestAdult(item.id)
                  return
                }
                setCategory(item.id)
              }}
              className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${!customSection && category === item.id ? "bg-primary text-primary-foreground" : "bg-white ring-1 ring-border"}`}
            >
              {item.label}
              <span className={`ml-1.5 text-xs ${!customSection && category === item.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{item.count}</span>
              {item.adult ? <span className="ml-1 text-[10px]">成人向</span> : null}
            </button>
          ))}
        </div>
        {customSection ? null : <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索编号或关键词"
            aria-label="搜索服装"
            className="h-10 bg-card pr-9 pl-8"
          />
          {query ? (
            <button type="button" className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground" onClick={() => setQuery("")} aria-label="清空服装搜索">
              <X className="size-4" />
            </button>
          ) : null}
        </div>}
      </div>
      <div className="px-4 py-4 @min-[768px]/studio:px-6">
        {customSection ? (
          <CustomReferencePanel
            kind="costume"
            items={visibleCustom}
            hiddenAdult={hiddenCustomAdult}
            isSelected={(id) => selectedId === id}
            onToggle={(id) => {
              const item = customCostumes.find((costume) => costume.id === id)
              if (!item) return
              onSelect({
                id: item.id,
                category: "自定义",
                label: item.label,
                keywords: item.keywords,
                adult: item.adult,
                thumb: "",
              })
            }}
            onDelete={onDeleteCustom}
            onSave={onSaveCustom}
            showAdult={showAdult}
            onRequestAdult={() => onRequestAdult("custom")}
            settings={settings}
            hasKey={hasKey}
            syncWarning={syncWarning}
            onChangeSettings={onChangeSettings}
          />
        ) : null}
        {!customSection && !catalog && !error ? (
          <div className="grid grid-cols-2 gap-3 @min-[640px]/studio:grid-cols-3 @min-[1280px]/studio:grid-cols-4 @min-[1536px]/studio:grid-cols-5">
            {Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[2/3] animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : null}
        {!customSection && error ? (
          <div className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm">
            {error}
            <div className="mt-3"><Button variant="outline" onClick={() => window.location.reload()}>重新加载</Button></div>
          </div>
        ) : null}
        {!customSection && catalog && costumes.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">没有对上的服装。</p> : null}
        {customSection ? null : <div className="grid grid-cols-2 gap-3 @min-[640px]/studio:grid-cols-3 @min-[1280px]/studio:grid-cols-4 @min-[1536px]/studio:grid-cols-5">
          {costumes.map((costume) => {
            const selected = selectedId === costume.id
            return (
              <button
                key={costume.id}
                type="button"
                onClick={() => onSelect(costume)}
                aria-pressed={selected}
                className={`overflow-hidden rounded-xl border bg-card text-left shadow-sm ${selected ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/40"}`}
              >
                <div className="relative aspect-[3/4] bg-white @min-[640px]/studio:aspect-[2/3]">
                  <img
                    src={studioUrl(basePath, `/api/costume-image?id=${encodeURIComponent(costume.id)}&size=thumb`)}
                    alt={`${costume.id}，${costume.keywords}`}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                  {selected ? <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">换这套</span> : null}
                </div>
                <div className="space-y-1 px-3 py-2.5">
                  <p className="text-sm font-medium">{costume.id}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground @min-[640px]/studio:line-clamp-2">{costume.label} · {costume.keywords}</p>
                </div>
              </button>
            )
          })}
        </div>}
        {!customSection && catalog ? <p className="mt-6 text-xs leading-5 text-muted-foreground">{catalog.attribution}</p> : null}
      </div>
    </section>
  )
}
