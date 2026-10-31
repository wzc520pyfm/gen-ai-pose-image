"use client"

/* eslint-disable @next/next/no-img-element -- pose sketches are proxied bytes with an onError fallback */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ChevronDown, RotateCcw, Search, X } from "lucide-react"
import { CustomReferencePanel, type CustomCard, type CustomDraft } from "@/components/custom-reference-panel"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { StudioSettings } from "@/lib/settings"
import type { Catalog, Pose, PoseView } from "@/lib/types"
import { studioUrl, useStudioEnv } from "@/lib/studio-env"

const ANGLES = ["正面", "俯视", "仰视", "侧面", "斜侧"]

const THUMB_COLS = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4", "grid-cols-5"]
const POSE_GRID = "grid grid-cols-2 gap-3 @min-[640px]/poses:grid-cols-3 @min-[780px]/poses:grid-cols-4"

function orderedViews(pose: Pose) {
  return [...pose.views].sort((a, b) => {
    const ai = ANGLES.indexOf(a.angle)
    const bi = ANGLES.indexOf(b.angle)
    return (ai === -1 ? ANGLES.length : ai) - (bi === -1 ? ANGLES.length : bi)
  })
}

function shownView(pose: Pose, selectedViewId: string | undefined, cardViewId: string | undefined, angle: string) {
  if (selectedViewId) {
    const chosen = pose.views.find((view) => view.id === selectedViewId)
    if (chosen) return chosen
  }
  if (cardViewId) {
    const chosen = pose.views.find((view) => view.id === cardViewId)
    if (chosen) return chosen
  }
  if (angle) {
    const chosen = pose.views.find((view) => view.angle === angle)
    if (chosen) return chosen
  }
  return pose.views.find((view) => view.angle === "正面") ?? pose.views[0]
}

function PoseFigure({ view, alt, size = "thumb", compact = false }: { view: PoseView; alt: string; size?: "thumb" | "full"; compact?: boolean }) {
  const { basePath } = useStudioEnv()
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className={`grid h-full place-items-center text-center text-muted-foreground ${compact ? "px-0.5 text-[10px] leading-3" : "px-3 text-xs"}`}>
        {compact ? "无图" : "线稿暂时加载不到"}
      </div>
    )
  }
  return (
    <img
      src={studioUrl(basePath, `/api/pose-image?id=${encodeURIComponent(view.id)}&size=${size}`)}
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
  customPoses,
  onSaveCustom,
  onDeleteCustom,
  settings,
  hasKey,
  syncWarning,
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
  customPoses: CustomCard[]
  onSaveCustom: (draft: CustomDraft) => Promise<void>
  onDeleteCustom: (id: string) => void
  settings: StudioSettings
  hasKey: boolean
  syncWarning: string
}) {
  const [systemId, setSystemId] = useState("full")
  const customSection = systemId === "custom"
  const allSeries = systemId === "all"
  const [category, setCategory] = useState("全部")
  const [angle, setAngle] = useState("")
  const [query, setQuery] = useState("")
  const [cardViews, setCardViews] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<{ pose: Pose; view: PoseView } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      const typing = target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")
      if (event.key === "/" && !typing) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const system = !customSection && !allSeries
    ? catalog?.systems.find((item) => item.id === systemId) ?? catalog?.systems[0]
    : undefined
  const visibleCustom = customPoses.filter((item) => showAdult || !item.adult)
  const hiddenCustomAdult = customPoses.length - visibleCustom.length
  const visiblePoseCount = useMemo(() => {
    if (!catalog) return 0
    return catalog.poses.filter((pose) => showAdult || !pose.adult).length
  }, [catalog, showAdult])
  const categories = useMemo(() => {
    if (!catalog || (!allSeries && !system)) return ["全部"]
    const names = new Set<string>()
    for (const pose of catalog.poses) {
      if (!allSeries && pose.systemId !== system?.id) continue
      if (!showAdult && pose.adult) continue
      names.add(pose.category)
    }
    return ["全部", ...names]
  }, [catalog, system, allSeries, showAdult])

  useEffect(() => {
    if (!categories.includes(category)) setCategory("全部")
  }, [categories, category])

  useEffect(() => {
    if (!requestedSystem || !showAdult) return
    if (requestedSystem === "custom") {
      setSystemId("custom")
      onRequestedSystemApplied()
      return
    }
    if (!catalog?.systems.some((item) => item.id === requestedSystem)) return
    setSystemId(requestedSystem)
    setCategory("全部")
    onRequestedSystemApplied()
  }, [requestedSystem, showAdult, catalog, onRequestedSystemApplied])

  const poses = useMemo(() => {
    if (!catalog || (!allSeries && !system)) return []
    const parts = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return catalog.poses.filter((pose) => {
      if (!allSeries && pose.systemId !== system?.id) return false
      if (!showAdult && pose.adult) return false
      if (category !== "全部" && pose.category !== category) return false
      if (angle && !pose.views.some((view) => view.angle === angle)) return false
      if (parts.length === 0) return true
      const hay = `${pose.name} ${pose.code} ${pose.category} ${pose.system} ${pose.id}`.toLowerCase()
      return parts.every((part) => hay.includes(part))
    })
  }, [catalog, system, allSeries, query, category, angle, showAdult])

  const hiddenAdult = catalog
    ? catalog.poses.filter((pose) => (allSeries || pose.systemId === system?.id) && pose.adult).length
    : 0

  function setPerspective(next: string) {
    setAngle(next)
    setCardViews({})
  }

  function resetFilters() {
    setQuery("")
    setCategory("全部")
    setAngle("")
    setCardViews({})
  }

  function chooseView(pose: Pose, view: PoseView) {
    setCardViews((current) => ({ ...current, [pose.id]: view.id }))
    if (selected[pose.id] && selected[pose.id] !== view.id) onToggle(pose, view)
  }

  function activatePose(pose: Pose, view: PoseView) {
    if (selected[pose.id]) {
      const current = pose.views.find((item) => item.id === selected[pose.id]) ?? view
      setCardViews((prev) => ({ ...prev, [pose.id]: current.id }))
      onToggle(pose, current)
      return
    }
    onToggle(pose, view)
  }

  return (
    <section className="@container/poses flex min-h-0 flex-col">
      <div className="px-4 pt-3 pb-2 @min-[768px]/studio:px-6">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <SeriesPill active={allSeries} count={visiblePoseCount} onClick={() => { setSystemId("all"); setCategory("全部") }}>
            全部
          </SeriesPill>
          {catalog?.systems.map((item) => {
            const active = !customSection && !allSeries && item.id === system?.id
            return (
              <SeriesPill
                key={item.id}
                active={active}
                count={item.poseCount}
                adult={item.adult}
                title={item.name}
                onClick={() => {
                  if (item.adult && !showAdult) {
                    onRequestAdult(item.id)
                    return
                  }
                  setSystemId(item.id)
                  setCategory("全部")
                }}
              >
                {item.name}
              </SeriesPill>
            )
          })}
          <SeriesPill active={customSection} count={visibleCustom.length} onClick={() => setSystemId("custom")}>
            自定义
          </SeriesPill>
        </div>
        {customSection ? null : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[8.5rem] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索姿势名称、编号（如 P001）"
                aria-label="搜索姿势"
                className="h-8 bg-card pr-8 pl-8 text-sm"
              />
              {query ? (
                <button type="button" className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground" onClick={() => setQuery("")} aria-label="清空搜索">
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
            <div className="relative shrink-0">
              <select
                className="h-8 appearance-none rounded-lg border border-input bg-card py-0 pr-8 pl-2.5 text-sm leading-8 text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={category}
                aria-label="动作分类"
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((item) => (
                  <option key={item} value={item}>{item === "全部" ? "全部动作分类" : item}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
            <div className="flex max-w-full items-center gap-1.5 @min-[640px]/poses:ml-auto">
              <div role="radiogroup" aria-label="视角" className="inline-flex h-8 min-w-0 items-center overflow-x-auto rounded-full bg-secondary p-0.5">
                <AngleSegment active={angle === ""} onClick={() => setPerspective("")}>全部视角</AngleSegment>
                {ANGLES.map((item) => (
                  <AngleSegment key={item} active={angle === item} onClick={() => setPerspective(item)}>{item}</AngleSegment>
                ))}
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs text-muted-foreground ring-1 ring-border hover:bg-card hover:text-foreground"
              >
                <RotateCcw className="size-3.5" />
                重置
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 @min-[768px]/studio:px-6">
        {customSection ? (
          <CustomReferencePanel
            kind="pose"
            items={visibleCustom}
            hiddenAdult={hiddenCustomAdult}
            isSelected={(id) => selected[id] === id}
            onToggle={(id) => {
              const item = customPoses.find((pose) => pose.id === id)
              if (!item) return
              const pose: Pose = {
                id: item.id,
                system: "自定义",
                systemId: "custom",
                code: "自定义",
                category: "自定义",
                name: item.label,
                adult: item.adult,
                people: 1,
                views: [{ id: item.id, angle: "自定义", angleId: "custom", thumb: "", full: "" }],
              }
              onToggle(pose, pose.views[0])
            }}
            onDelete={onDeleteCustom}
            onSave={onSaveCustom}
            showAdult={showAdult}
            onRequestAdult={() => onRequestAdult("custom")}
            settings={settings}
            hasKey={hasKey}
            syncWarning={syncWarning}
          />
        ) : null}
        {!customSection && loading ? <PoseSkeleton /> : null}
        {!customSection && error ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center">
            <p className="text-sm">{error}</p>
            <Button className="mt-3" variant="outline" onClick={onRetry}>重新加载</Button>
          </div>
        ) : null}
        {!customSection && !loading && !error && poses.length === 0 ? (
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
        {customSection ? null : <div className={POSE_GRID}>
          {poses.map((pose) => {
            const view = shownView(pose, selected[pose.id], cardViews[pose.id], angle)
            if (!view) return null
            return (
              <PoseCard
                key={pose.id}
                pose={pose}
                view={view}
                selected={Boolean(selected[pose.id])}
                onActivate={() => activatePose(pose, view)}
                onChoose={(next) => chooseView(pose, next)}
                onPreview={() => setPreview({ pose, view })}
              />
            )
          })}
        </div>}
        {catalog && !customSection ? (
          <p className="mt-6 max-w-3xl text-xs leading-5 text-muted-foreground">
            {catalog.attribution} 图床：{catalog.origin}。索引来自 {catalog.source}。
          </p>
        ) : null}
      </div>

      <Dialog open={preview !== null} onOpenChange={(open) => { if (!open) setPreview(null) }}>
        <DialogContent className="max-w-[min(36rem,calc(100%-2rem))]">
          {preview ? (
            <>
              <DialogHeader>
                <DialogTitle>{preview.pose.name}</DialogTitle>
                <DialogDescription>{preview.pose.code} · {preview.pose.system} · {preview.pose.category} · {preview.view.angle}</DialogDescription>
              </DialogHeader>
              <div className="mx-auto aspect-[3/4] w-full max-w-sm bg-white">
                <PoseFigure view={preview.view} alt={preview.pose.name} size="full" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {orderedViews(preview.pose).map((view) => (
                  <Button key={view.id} size="sm" variant={view.id === preview.view.id ? "default" : "outline"} onClick={() => setPreview({ pose: preview.pose, view })}>
                    {view.angle}
                  </Button>
                ))}
              </div>
              <Button onClick={() => {
                setCardViews((current) => ({ ...current, [preview.pose.id]: preview.view.id }))
                onToggle(preview.pose, preview.view)
                setPreview(null)
              }}>
                {selected[preview.pose.id] === preview.view.id ? "从选择里去掉" : "用这个角度生图"}
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  )
}

function SeriesPill({
  active,
  count,
  adult = false,
  title,
  onClick,
  children,
}: {
  active: boolean
  count: number
  adult?: boolean
  title?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm whitespace-nowrap ${active ? "bg-primary text-primary-foreground" : "bg-card text-foreground ring-1 ring-border"}`}
    >
      <span>{children}</span>
      <span className={`text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{count}</span>
      {adult ? <span className={`text-[10px] ${active ? "text-primary-foreground/80" : "text-amber-700"}`}>成人向</span> : null}
    </button>
  )
}

function AngleSegment({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs whitespace-nowrap ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  )
}

function PoseCard({
  pose,
  view,
  selected,
  onActivate,
  onChoose,
  onPreview,
}: {
  pose: Pose
  view: PoseView
  selected: boolean
  onActivate: () => void
  onChoose: (view: PoseView) => void
  onPreview: () => void
}) {
  const views = orderedViews(pose)
  const columns = THUMB_COLS[Math.min(views.length, 5)] ?? "grid-cols-5"
  return (
    <article className={`min-w-0 rounded-xl border bg-card shadow-sm transition ${selected ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/40"}`}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-t-xl bg-white">
        <button type="button" className="block h-full w-full" onClick={onActivate} aria-pressed={selected}>
          <PoseFigure key={view.id} view={view} alt={`${pose.name}，${view.angle}`} />
        </button>
        {selected ? (
          <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">已选</span>
        ) : null}
        <button
          type="button"
          className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white"
          onClick={onPreview}
        >
          看线稿
        </button>
      </div>
      <div className="flex items-start justify-between gap-2 px-2.5 py-2">
        <h3 className="line-clamp-2 min-w-0 flex-1 text-sm leading-5 font-medium">{pose.name}</h3>
        <span className="max-w-[46%] shrink-0 truncate pt-0.5 text-right text-xs text-muted-foreground" title={pose.category}>{pose.category}</span>
      </div>
      <div role="group" aria-label={`${pose.name}的视角`} className={`grid gap-1 px-2 pb-2.5 ${columns}`}>
        {views.map((item) => {
          const active = item.id === view.id
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChoose(item)}
              className={`flex min-w-0 flex-col items-center gap-0.5 rounded-md px-0.5 pt-0.5 pb-1 ${active ? "ring-2 ring-foreground" : "ring-1 ring-border hover:bg-muted"}`}
            >
              <span className="block aspect-[3/4] w-full overflow-hidden rounded-sm bg-white">
                <PoseFigure view={item} alt="" size="thumb" compact />
              </span>
              <span className={`max-w-full truncate text-[10px] leading-4 ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}>{item.angle}</span>
            </button>
          )
        })}
      </div>
    </article>
  )
}

function PoseSkeleton() {
  return (
    <div className={`mb-4 ${POSE_GRID}`}>
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  )
}
