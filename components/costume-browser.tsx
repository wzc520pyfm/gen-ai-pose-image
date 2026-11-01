"use client"

/* eslint-disable @next/next/no-img-element -- costume references are proxied webp files */

import { useEffect, useMemo, useState } from "react"
import { CustomReferencePanel, type CustomCard, type CustomDraft } from "@/components/custom-reference-panel"
import { Alert, Button, Card, Chip, SearchField, Skeleton, ToggleButton, ToggleButtonGroup } from "@heroui/react"
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
      <div className="px-4 pt-3 pb-2 @min-[768px]/studio:px-6">
        <p className="mb-2 text-sm text-muted-foreground">这些图里没有人物。选一套之后，大肥鱼会换上这身衣服，脸、头发、鲸耳和鲸尾保持不变。</p>
        <ToggleButtonGroup
          aria-label="服装分类"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[category]}
          onSelectionChange={(keys) => {
            const id = firstKey(keys)
            if (!id) return
            if (id === "custom") {
              setCategory("custom")
              return
            }
            const item = catalog?.categories.find((entry) => entry.id === id)
            if (item?.adult && !showAdult) {
              onRequestAdult(item.id)
              return
            }
            setCategory(id)
          }}
          className="mb-2 flex flex-wrap gap-2"
        >
          <ToggleButton id="custom">自定义 {visibleCustom.length}</ToggleButton>
          {catalog?.categories.map((item) => (
            <ToggleButton key={item.id} id={item.id}>
              {item.label} {item.count}{item.adult ? " 成人向" : ""}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {customSection ? null : (
          <SearchField aria-label="搜索服装" value={query} onChange={setQuery}>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="搜索编号或关键词" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        )}
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
            {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="block aspect-[2/3] w-full rounded-2xl" />)}
          </div>
        ) : null}
        {!customSection && error ? (
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
        {!customSection && catalog && costumes.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">没有对上的服装。</p> : null}
        {customSection ? null : <div className="grid grid-cols-2 gap-3 @min-[640px]/studio:grid-cols-3 @min-[1280px]/studio:grid-cols-4 @min-[1536px]/studio:grid-cols-5">
          {costumes.map((costume) => {
            const selected = selectedId === costume.id
            return (
              <Card key={costume.id} className={`overflow-hidden text-left shadow-sm ${selected ? "border-primary ring-2 ring-primary/25" : "border-border"}`}>
                <Card.Header className="relative aspect-[3/4] bg-white p-0 @min-[640px]/studio:aspect-[2/3]">
                  <button type="button" className="block h-full w-full" onClick={() => onSelect(costume)} aria-pressed={selected}>
                    <img
                      src={studioUrl(basePath, `/api/costume-image?id=${encodeURIComponent(costume.id)}&size=thumb`)}
                      alt={`${costume.id}，${costume.keywords}`}
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  </button>
                  {selected ? <Chip color="accent" size="sm" className="pointer-events-none absolute top-2 left-2">已选</Chip> : null}
                </Card.Header>
                <Card.Footer className="block space-y-1 px-3 py-2.5">
                  <Card.Title className="text-sm font-medium">{costume.id}</Card.Title>
                  <Card.Description className="line-clamp-1 text-xs @min-[640px]/studio:line-clamp-2">{costume.label} · {costume.keywords}</Card.Description>
                </Card.Footer>
              </Card>
            )
          })}
        </div>}
        {!customSection && catalog ? <p className="mt-6 text-xs leading-5 text-muted-foreground">{catalog.attribution}</p> : null}
      </div>
    </section>
  )
}

function firstKey(keys: Iterable<unknown> | "all") {
  if (keys === "all") return null
  for (const key of keys) return String(key)
  return null
}
