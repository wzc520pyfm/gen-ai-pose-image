"use client"

/* eslint-disable @next/next/no-img-element -- costume references are proxied webp files */

import { useEffect, useMemo, useState } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
}: {
  showAdult: boolean
  focusCategory: string | null
  onFocusApplied: () => void
  onRequestAdult: (categoryId: string) => void
  selectedId: string | null
  onSelect: (costume: Costume) => void
}) {
  const [catalog, setCatalog] = useState<CostumeCatalog | null>(null)
  const [error, setError] = useState("")
  const [category, setCategory] = useState("春")
  const [query, setQuery] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/costumes", { signal: controller.signal })
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
  }, [])

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
      <div className="sticky top-0 z-10 border-b border-border/70 bg-[var(--background)]/90 px-4 py-3 backdrop-blur md:px-6">
        <p className="mb-2 text-sm text-muted-foreground">这些图里没有人物。选一套之后，大飞鱼会换上这身衣服，脸、头发、鲸耳和鲸尾保持不变。</p>
        <div className="flex gap-2 overflow-x-auto pb-2">
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
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${category === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
            >
              {item.label}
              <span className="ml-1.5 text-xs opacity-80">{item.count}</span>
              {item.adult ? <span className="ml-1 text-[10px]">成人向</span> : null}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索编号或英文关键词，例如 denim、SPR-0001"
            aria-label="搜索服装"
            className="h-10 bg-card pr-9 pl-8"
          />
          {query ? (
            <button type="button" className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground" onClick={() => setQuery("")} aria-label="清空服装搜索">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="px-4 py-4 md:px-6">
        {!catalog && !error ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[2/3] animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm">
            {error}
            <div className="mt-3"><Button variant="outline" onClick={() => window.location.reload()}>重新加载</Button></div>
          </div>
        ) : null}
        {catalog && costumes.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">没有对上的服装。</p> : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {costumes.map((costume) => {
            const selected = selectedId === costume.id
            return (
              <button
                key={costume.id}
                type="button"
                onClick={() => onSelect(costume)}
                aria-pressed={selected}
                className={`overflow-hidden rounded-2xl border bg-card text-left shadow-sm ${selected ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
              >
                <div className="relative aspect-[2/3] bg-white">
                  <img
                    src={`/api/costume-image?id=${encodeURIComponent(costume.id)}&size=thumb`}
                    alt={`${costume.id}，${costume.keywords}`}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                  {selected ? <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">换这套</span> : null}
                </div>
                <div className="space-y-1 px-3 py-2.5">
                  <p className="text-sm font-medium">{costume.id}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{costume.label} · {costume.keywords}</p>
                </div>
              </button>
            )
          })}
        </div>
        {catalog ? <p className="mt-6 text-xs leading-5 text-muted-foreground">{catalog.attribution}</p> : null}
      </div>
    </section>
  )
}
