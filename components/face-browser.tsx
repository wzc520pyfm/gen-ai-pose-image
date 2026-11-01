"use client"

/* eslint-disable @next/next/no-img-element -- face references are proxied remote images */

import { useEffect, useMemo, useState } from "react"
import { Alert, Button, Card, Chip, SearchField, Skeleton, ToggleButton, ToggleButtonGroup } from "@heroui/react"
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
      <div className="px-4 pt-3 pb-2 @min-[768px]/studio:px-6">
        <p className="mb-2 text-sm leading-5 text-muted-foreground">
          选一张脸部参考。生图会把这张图的五官、表情、脸型和发型用到角色上，姿势和服装仍按各自的参考。鲸耳和鲸尾保留。
        </p>
        <ToggleButtonGroup
          aria-label="脸部分组"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[section || "all"]}
          onSelectionChange={(keys) => {
            const id = firstKey(keys)
            if (id == null) return
            setSection(id === "all" ? "" : id)
          }}
          className="flex flex-wrap gap-1.5"
        >
          <ToggleButton id="all">全部{catalog ? ` ${catalog.total}` : ""}</ToggleButton>
          {catalog?.sections.map((item) => (
            <ToggleButton key={item.id} id={item.id}>{item.label} {item.count}</ToggleButton>
          ))}
        </ToggleButtonGroup>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SearchField aria-label="搜索脸部参考" value={query} onChange={setQuery} className="min-w-[8.5rem] flex-1">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="搜索编号、发长或造型" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ToggleButtonGroup
            aria-label="发长"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[hair || "all"]}
            onSelectionChange={(keys) => {
              const id = firstKey(keys)
              if (id == null) return
              setHair(id === "all" ? "" : id)
            }}
            className="max-w-full overflow-x-auto"
          >
            <ToggleButton id="all">全部发长</ToggleButton>
            {catalog?.hairs.map((item) => (
              <ToggleButton key={item.id} id={item.id}>{item.label} {hairCounts.get(item.id) ?? 0}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Button
            variant="outline"
            size="sm"
            onPress={randomFace}
            isDisabled={faces.length === 0}
            className="border-[#fb7185]/50 bg-[#fff1f2] text-[#be123c]"
          >
            随机一张
          </Button>
        </div>
      </div>
      <div className="px-4 py-4 @min-[768px]/studio:px-6">
        {!catalog && !error ? (
          <div className="grid grid-cols-2 gap-3 @min-[640px]/studio:grid-cols-3 @min-[1280px]/studio:grid-cols-4 @min-[1536px]/studio:grid-cols-5">
            {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="block aspect-[4/5] w-full rounded-2xl" />)}
          </div>
        ) : null}
        {error ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{error}</Alert.Title>
              <Alert.Description>
                <Button className="mt-2" variant="outline" onPress={() => window.location.reload()}>重新加载</Button>
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
        {catalog && faces.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">没有对上的脸部参考。</p> : null}
        {catalog ? (
          <div className="grid grid-cols-2 gap-3 @min-[640px]/studio:grid-cols-3 @min-[1280px]/studio:grid-cols-4 @min-[1536px]/studio:grid-cols-5">
            {visible.map((face) => {
              const selected = selectedId === face.id
              const caption = [face.section, face.hair, face.label].filter(Boolean).join(" · ")
              return (
                <Card key={face.id} className={`overflow-hidden text-left shadow-sm ${selected ? "border-primary ring-2 ring-primary/25" : "border-border"}`}>
                  <Card.Header className="relative aspect-[4/5] bg-white p-0">
                    <button type="button" className="block h-full w-full" onClick={() => onSelect(face)} aria-pressed={selected}>
                      <img
                        src={studioUrl(basePath, `/api/face-image?id=${encodeURIComponent(face.id)}&size=thumb`)}
                        alt={`${face.id}，${caption}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </button>
                    {selected ? <Chip color="accent" size="sm" className="pointer-events-none absolute top-2 left-2">已选</Chip> : null}
                  </Card.Header>
                  <Card.Footer className="block space-y-1 px-3 py-2.5">
                    <Card.Title className="truncate text-sm font-medium">{face.id}</Card.Title>
                    <Card.Description className="line-clamp-2 text-xs">{caption}</Card.Description>
                  </Card.Footer>
                </Card>
              )
            })}
          </div>
        ) : null}
        {catalog && shown < faces.length ? (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onPress={() => setShown((count) => count + 80)}>继续显示（还有 {faces.length - shown}）</Button>
          </div>
        ) : null}
        {catalog ? <p className="mt-6 text-xs leading-5 text-muted-foreground">{catalog.attribution}</p> : null}
      </div>
    </section>
  )
}

function firstKey(keys: Iterable<unknown> | "all") {
  if (keys === "all") return null
  for (const key of keys) return String(key)
  return null
}
