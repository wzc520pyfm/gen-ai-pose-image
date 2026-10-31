"use client"

/* eslint-disable @next/next/no-img-element -- face references are proxied remote images */

import { useEffect, useMemo, useState } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { studioUrl, useStudioEnv } from "@/lib/studio-env"

export type FaceItem = {
  id: string
  section: string
  hair: string
  label: string
  keywords: string
  hot: boolean
}

type FaceGroup = {
  id: string
  label: string
  count: number
}

type FaceCatalog = {
  total: number
  attribution: string
  author: string
  origin: string
  source: string
  sections: FaceGroup[]
  hairs: FaceGroup[]
  faces: FaceItem[]
}

export function FaceBrowser({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (face: FaceItem) => void
}) {
  const { basePath } = useStudioEnv()
  const [catalog, setCatalog] = useState<FaceCatalog | null>(null)
  const [error, setError] = useState("")
  const [section, setSection] = useState("")
  const [hair, setHair] = useState("")
  const [query, setQuery] = useState("")
  const [shown, setShown] = useState(80)

  useEffect(() => {
    const controller = new AbortController()
    fetch(studioUrl(basePath, "/api/faces"), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("脸部目录没有加载出来")
        return response.json() as Promise<FaceCatalog>
      })
      .then(setCatalog)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return
        setError(cause instanceof Error ? cause.message : "脸部目录没有加载出来")
      })
    return () => controller.abort()
  }, [basePath])

  const hairCounts = useMemo(() => {
    const counts = new Map<string, number>()
    if (!catalog) return counts
    for (const face of catalog.faces) {
      if (section && face.section !== section) continue
      counts.set(face.hair, (counts.get(face.hair) ?? 0) + 1)
    }
    return counts
  }, [catalog, section])

  const faces = useMemo(() => {
    if (!catalog) return []
    const parts = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return catalog.faces.filter((face) => {
      if (section && face.section !== section) return false
      if (hair && face.hair !== hair) return false
      if (!parts.length) return true
      const hay = `${face.id} ${face.section} ${face.hair} ${face.label} ${face.keywords} ${face.hot ? "热门" : ""}`.toLowerCase()
      return parts.every((part) => hay.includes(part))
    })
  }, [catalog, section, hair, query])

  useEffect(() => {
    setShown(80)
  }, [section, hair, query])

  const visible = faces.slice(0, shown)

  function randomFace() {
    const pool = visible.length > 0 ? visible : faces
    if (pool.length === 0) return
    let index = Math.floor(Math.random() * pool.length)
    if (pool.length > 1 && pool[index]?.id === selectedId) index = (index + 1) % pool.length
    const face = pool[index]
    if (!face || face.id === selectedId) return
    onSelect(face)
  }

  return (
    <section>
      <div className="sticky top-0 z-10 border-b bg-white/95 px-4 py-3 backdrop-blur @min-[768px]/studio:px-6">
        <p className="mb-2 text-sm leading-6 text-muted-foreground">
          选一张脸部参考。生图会把这张图的五官、表情、脸型和发型用上，姿势和服装仍按各自的参考。选了模特时，鲸耳和鲸尾按该角色保留；没选模特时，身份以这张脸为准，不另加鲸耳或鲸尾。
        </p>
        <div className="mb-2 flex flex-wrap gap-2">
          <FilterChip active={section === ""} onClick={() => setSection("")} label="全部" count={catalog?.total} />
          {catalog?.sections.map((item) => (
            <FilterChip key={item.id} active={section === item.id} onClick={() => setSection(item.id)} label={item.label} count={item.count} />
          ))}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <FilterChip active={hair === ""} onClick={() => setHair("")} label="全部发长" />
          {catalog?.hairs.map((item) => (
            <FilterChip key={item.id} active={hair === item.id} onClick={() => setHair(item.id)} label={item.label} count={hairCounts.get(item.id) ?? 0} />
          ))}
          <button type="button" className="rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-border" onClick={randomFace} disabled={faces.length === 0}>
            随机一张
          </button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索编号、发长或造型"
            aria-label="搜索脸部参考"
            className="h-10 bg-card pr-9 pl-8"
          />
          {query ? (
            <button type="button" className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground" onClick={() => setQuery("")} aria-label="清空脸部搜索">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="px-4 py-4 @min-[768px]/studio:px-6">
        {!catalog && !error ? (
          <div className="grid grid-cols-2 gap-3 @min-[640px]/studio:grid-cols-3 @min-[1280px]/studio:grid-cols-4 @min-[1536px]/studio:grid-cols-5">
            {Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[4/5] animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm">
            {error}
            <div className="mt-3"><Button variant="outline" onClick={() => window.location.reload()}>重新加载</Button></div>
          </div>
        ) : null}
        {catalog && faces.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">没有对上的脸部参考。</p> : null}
        {catalog ? (
          <div className="grid grid-cols-2 gap-3 @min-[640px]/studio:grid-cols-3 @min-[1280px]/studio:grid-cols-4 @min-[1536px]/studio:grid-cols-5">
            {visible.map((face) => {
              const selected = selectedId === face.id
              const caption = [face.section, face.hair, face.label].filter(Boolean).join(" · ")
              return (
                <button
                  key={face.id}
                  type="button"
                  onClick={() => onSelect(face)}
                  aria-pressed={selected}
                  className={`overflow-hidden rounded-xl border bg-card text-left shadow-sm ${selected ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/40"}`}
                >
                  <div className="relative aspect-[4/5] bg-white">
                    <img
                      src={studioUrl(basePath, `/api/face-image?id=${encodeURIComponent(face.id)}&size=thumb`)}
                      alt={`${face.id}，${caption}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    {selected ? <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">用这张脸</span> : null}
                  </div>
                  <div className="space-y-1 px-3 py-2.5">
                    <p className="truncate text-sm font-medium">{face.id}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{caption}</p>
                  </div>
                </button>
              )
            })}
          </div>
        ) : null}
        {catalog && shown < faces.length ? (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={() => setShown((count) => count + 80)}>继续显示（还有 {faces.length - shown}）</Button>
          </div>
        ) : null}
        {catalog ? <p className="mt-6 text-xs leading-5 text-muted-foreground">{catalog.attribution}</p> : null}
      </div>
    </section>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${active ? "bg-primary text-primary-foreground" : "bg-white ring-1 ring-border"}`}
    >
      {label}
      {count !== undefined ? <span className={`ml-1.5 text-xs ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{count}</span> : null}
    </button>
  )
}
