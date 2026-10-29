"use client"

/* eslint-disable @next/next/no-img-element -- pose sketches are proxied bytes with an onError fallback */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { Catalog, Pose, PoseView } from "@/lib/types"

const ANGLES = ["正面", "斜侧", "侧面", "俯视", "仰视"]

const SHORT_SYSTEM: Record<string, string> = {
  full: "标准全身",
  sexy: "性感全身",
  bust: "上半身",
  pair: "双人",
}

function displayView(pose: Pose, selectedViewId: string | undefined, angle: string) {
  if (selectedViewId) {
    const chosen = pose.views.find((view) => view.id === selectedViewId)
    if (chosen) return chosen
  }
  if (angle) return pose.views.find((view) => view.angle === angle)
  return pose.views.find((view) => view.angle === "正面") ?? pose.views[0]
}

function PoseFigure({ view, alt, size = "thumb" }: { view: PoseView; alt: string; size?: "thumb" | "full" }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return <div className="grid h-full place-items-center px-3 text-center text-xs text-muted-foreground">线稿暂时加载不到</div>
  }
  return (
    <img
      src={`/api/pose-image?id=${encodeURIComponent(view.id)}&size=${size}`}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-full w-full object-contain"
    />
  )
}

export function PoseBrowser({
  catalog,
  loading,
  error,
  onRetry,
  showAdult,
  requestedSystem,
  onRequestedSystemApplied,
  onRequestAdult,
  selected,
  onToggle,
}: {
  catalog: Catalog | null
  loading: boolean
  error: string
  onRetry: () => void
  showAdult: boolean
  requestedSystem: string | null
  onRequestedSystemApplied: () => void
  onRequestAdult: (systemId: string) => void
  selected: Record<string, string>
  onToggle: (pose: Pose, view: PoseView) => void
}) {
  const [systemId, setSystemId] = useState("full")
  const [category, setCategory] = useState("全部")
  const [angle, setAngle] = useState("")
  const [query, setQuery] = useState("")
  const [preview, setPreview] = useState<{ pose: Pose; view: PoseView } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      const typing = target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      if (event.key === "/" && !typing) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const system = catalog?.systems.find((item) => item.id === systemId) ?? catalog?.systems[0]
  const categories = useMemo(() => {
    if (!catalog || !system) return ["全部"]
    const names = new Set<string>()
    for (const pose of catalog.poses) {
      if (pose.systemId !== system.id) continue
      if (!showAdult && pose.adult) continue
      names.add(pose.category)
    }
    return ["全部", ...names]
  }, [catalog, system, showAdult])

  useEffect(() => {
    if (!categories.includes(category)) setCategory("全部")
  }, [categories, category])

  useEffect(() => {
    if (!requestedSystem || !showAdult) return
    if (!catalog?.systems.some((item) => item.id === requestedSystem)) return
    setSystemId(requestedSystem)
    setCategory("全部")
    onRequestedSystemApplied()
  }, [requestedSystem, showAdult, catalog, onRequestedSystemApplied])

  const poses = useMemo(() => {
    if (!catalog || !system) return []
    const parts = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return catalog.poses.filter((pose) => {
      if (pose.systemId !== system.id) return false
      if (!showAdult && pose.adult) return false
      if (category !== "全部" && pose.category !== category) return false
      if (angle && !pose.views.some((view) => view.angle === angle)) return false
      if (parts.length === 0) return true
      const hay = `${pose.name} ${pose.code} ${pose.category} ${pose.system} ${pose.id}`.toLowerCase()
      return parts.every((part) => hay.includes(part))
    })
  }, [catalog, system, query, category, angle, showAdult])

  const hiddenAdult = catalog && system
    ? catalog.poses.filter((pose) => pose.systemId === system.id && pose.adult).length
    : 0

  return (
    <section className="flex min-h-0 flex-col">
      <div className="sticky top-0 z-10 border-b bg-white/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex flex-wrap gap-2">
          {catalog?.systems.map((item) => {
            const active = item.id === system?.id
            return (
              <button
                key={item.id}
                type="button"
                title={item.name}
                onClick={() => {
                  if (item.adult && !showAdult) {
                    onRequestAdult(item.id)
                    return
                  }
                  setSystemId(item.id)
                  setCategory("全部")
                }}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm leading-5 ${active ? "bg-primary text-primary-foreground" : "bg-white text-foreground ring-1 ring-border"}`}
              >
                <span>{SHORT_SYSTEM[item.id] ?? item.name}</span>
                <span className={`text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{item.poseCount}</span>
                {item.adult ? <span className={`text-[10px] ${active ? "text-primary-foreground/80" : "text-amber-700"}`}>成人向</span> : null}
              </button>
            )
          })}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索姿势名、编号或分类"
            aria-label="搜索姿势"
            className="h-10 bg-card pr-9 pl-8"
          />
          {query ? (
            <button type="button" className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground" onClick={() => setQuery("")} aria-label="清空搜索">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <FilterChip active={angle === ""} onClick={() => setAngle("")}>全部视角</FilterChip>
          {ANGLES.map((item) => (
            <FilterChip key={item} active={angle === item} onClick={() => setAngle(item)}>{item}</FilterChip>
          ))}
        </div>
        <label className="mt-2 block text-xs text-muted-foreground md:hidden">
          分类
          <select
            className="mt-1 h-10 w-full rounded-lg border bg-card px-2 text-sm text-foreground"
            value={category}
            aria-label="姿势分类"
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <div className="mt-2 hidden flex-wrap gap-1.5 md:flex">
          {categories.map((item) => (
            <FilterChip key={item} active={category === item} onClick={() => setCategory(item)}>{item}</FilterChip>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 md:px-6">
        {loading ? <PoseSkeleton /> : null}
        {error ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center">
            <p className="text-sm">{error}</p>
            <Button className="mt-3" variant="outline" onClick={onRetry}>重新加载</Button>
          </div>
        ) : null}
        {!loading && !error && poses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-12 text-center">
            <p className="text-lg font-semibold">没有对上的姿势</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hiddenAdult > 0 && !showAdult ? `这一体系里有 ${hiddenAdult} 个成人向姿势被收着。` : "换个词，或把分类、视角清掉。"}
            </p>
            {hiddenAdult > 0 && !showAdult ? (
              <Button className="mt-3" variant="outline" onClick={() => onRequestAdult(system?.id ?? "sexy")}>显示成人向姿势</Button>
            ) : null}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {poses.map((pose) => {
            const view = displayView(pose, selected[pose.id], angle)
            if (!view) return null
            return (
              <article key={pose.id} className={`overflow-hidden rounded-xl border bg-card shadow-sm transition ${selected[pose.id] ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/40"}`}>
                <button type="button" className="block w-full text-left" onClick={() => onToggle(pose, view)} aria-pressed={Boolean(selected[pose.id])}>
                  <div className="relative aspect-[3/4] bg-white">
                    <PoseFigure view={view} alt={`${pose.name}，${view.angle}`} />
                    {selected[pose.id] ? (
                      <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">已选</span>
                    ) : null}
                    <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">{view.angle}</span>
                  </div>
                  <div className="space-y-1 px-2.5 py-2 sm:px-3 sm:py-2.5">
                    <h3 className="line-clamp-2 text-sm leading-5 font-medium">{pose.name}</h3>
                    <p className="truncate text-xs text-muted-foreground">{pose.code} · {pose.category}</p>
                  </div>
                </button>
                <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 sm:px-3 sm:pb-3">
                  <button type="button" className="shrink-0 text-xs text-primary underline-offset-2 hover:underline" onClick={() => setPreview({ pose, view })}>
                    看线稿
                  </button>
                  {selected[pose.id] ? <Badge variant="secondary">{pose.people === 2 ? "双人" : "单人"}</Badge> : <span className="truncate text-[11px] text-muted-foreground">点卡片加入</span>}
                </div>
              </article>
            )
          })}
        </div>
        {catalog ? (
          <p className="mt-6 max-w-3xl text-xs leading-5 text-muted-foreground">
            {catalog.attribution} 图床：{catalog.origin}。索引来自 {catalog.source}。
          </p>
        ) : null}
      </div>

      <Dialog open={preview !== null} onOpenChange={(open) => { if (!open) setPreview(null) }}>
        <DialogContent className="sm:max-w-xl">
          {preview ? (
            <>
              <DialogHeader>
                <DialogTitle>{preview.pose.name}</DialogTitle>
                <DialogDescription>{preview.pose.system} · {preview.pose.category} · {preview.view.angle}</DialogDescription>
              </DialogHeader>
              <div className="mx-auto aspect-[3/4] w-full max-w-sm bg-white">
                <PoseFigure view={preview.view} alt={preview.pose.name} size="full" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {preview.pose.views.map((view) => (
                  <Button key={view.id} size="sm" variant={view.id === preview.view.id ? "default" : "outline"} onClick={() => setPreview({ pose: preview.pose, view })}>
                    {view.angle}
                  </Button>
                ))}
              </div>
              <Button onClick={() => { onToggle(preview.pose, preview.view); setPreview(null) }}>
                {selected[preview.pose.id] === preview.view.id ? "从选择里去掉" : "用这个角度生图"}
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs leading-5 ${active ? "bg-foreground text-background" : "bg-white text-muted-foreground ring-1 ring-border"}`}
    >
      {children}
    </button>
  )
}

function PoseSkeleton() {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  )
}
