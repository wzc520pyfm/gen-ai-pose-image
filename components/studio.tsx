"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Settings } from "lucide-react"
import { CharacterDock } from "@/components/character-dock"
import { Composer, type ResultCard } from "@/components/composer"
import { PoseBrowser } from "@/components/pose-browser"
import { SettingsDialog } from "@/components/settings-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { WhaleMark } from "@/components/whale-mark"
import { readStoredCharacters, writeStoredCharacters, type StoredCharacter } from "@/lib/characters"
import { baseURLFor, DEFAULT_SETTINGS, loadSettings, modelFor, saveSettings, type StudioSettings } from "@/lib/settings"
import type { Catalog, Pose, PoseView, PromptCard } from "@/lib/types"

type Selection = Record<string, string>

export function Studio() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catalogError, setCatalogError] = useState("")
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS)
  const [requestedSystem, setRequestedSystem] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const [adultAsk, setAdultAsk] = useState<string | null>(null)
  const [characters, setCharacters] = useState<StoredCharacter[]>([])
  const [selected, setSelected] = useState<Selection>({})
  const [extraPrompt, setExtraPrompt] = useState("")
  const [prompts, setPrompts] = useState<PromptCard[]>([])
  const [promptError, setPromptError] = useState("")
  const [results, setResults] = useState<ResultCard[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState("")
  const [runError, setRunError] = useState("")
  const [limitNote, setLimitNote] = useState("")
  const [serverKey, setServerKey] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const clearRequestedSystem = useCallback(() => setRequestedSystem(null), [])
  const abortRef = useRef<AbortController | null>(null)

  const loadCatalog = useCallback(() => {
    setLoading(true)
    setCatalogError("")
    fetch("/api/catalog")
      .then(async (response) => {
        if (!response.ok) throw new Error("姿势目录没有加载出来")
        return response.json() as Promise<Catalog>
      })
      .then(setCatalog)
      .catch((error: unknown) => setCatalogError(error instanceof Error ? error.message : "姿势目录没有加载出来"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadCatalog() }, [loadCatalog])
  useEffect(() => {
    const local = loadSettings()
    fetch("/api/status")
      .then((response) => response.json())
      .then((payload: { keyConfigured?: boolean; provider?: string; model?: string; baseURL?: string }) => {
        setServerKey(Boolean(payload.keyConfigured))
        const untouched = local.provider === "gemini" && local.apiKey.trim() === "" && (local.model === modelFor("gemini") || local.model.trim() === "")
        if (untouched && payload.provider === "seedream") {
          const next = {
            ...local,
            provider: "seedream" as const,
            model: payload.model || modelFor("seedream"),
            baseURL: payload.baseURL || baseURLFor("seedream"),
          }
          setSettings(next)
          saveSettings(next)
          return
        }
        setSettings(local)
      })
      .catch(() => setSettings(local))
  }, [])
  useEffect(() => {
    readStoredCharacters().then(setCharacters).catch(() => {})
  }, [])

  function updateSettings(next: StudioSettings) {
    setSettings(next)
    saveSettings(next)
  }

  function updateCharacters(next: StoredCharacter[]) {
    setCharacters(next)
    writeStoredCharacters(next).catch(() => {})
  }

  const poseById = useMemo(() => {
    const map = new Map<string, Pose>()
    catalog?.poses.forEach((pose) => map.set(pose.id, pose))
    return map
  }, [catalog])

  const chosen = useMemo(() => {
    return Object.entries(selected).flatMap(([poseId, viewId]) => {
      const pose = poseById.get(poseId)
      const view = pose?.views.find((item) => item.id === viewId)
      if (!pose || !view) return []
      return [{ poseId, viewId, title: pose.name, angle: view.angle }]
    })
  }, [selected, poseById])

  const selectionKey = chosen.map((item) => item.viewId).join("|")

  useEffect(() => {
    if (!selectionKey) {
      setPrompts([])
      setPromptError("")
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      fetch("/api/prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          mode: settings.mode,
          viewIds: selectionKey.split("|"),
          keepOutfit: settings.keepOutfit,
          extraPrompt,
          characterCount: characters.length,
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json() as { prompts?: PromptCard[]; error?: string }
          if (!response.ok) throw new Error(payload.error || "提示词没有生成")
          setPrompts(payload.prompts ?? [])
          setPromptError("")
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return
          setPromptError(error instanceof Error ? error.message : "提示词没有生成")
        })
    }, 280)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [selectionKey, extraPrompt, characters.length, settings.provider, settings.mode, settings.keepOutfit])

  function togglePose(pose: Pose, view: PoseView) {
    if (selected[pose.id] === view.id) {
      setLimitNote("")
      setSelected((current) => {
        const next = { ...current }
        delete next[pose.id]
        return next
      })
      return
    }
    const limit = settings.mode === "sheet" ? 4 : 8
    if (!selected[pose.id] && Object.keys(selected).length >= limit) {
      setLimitNote(settings.mode === "sheet" ? "拼图一次最多 4 个姿势。" : "一次最多 8 个姿势。")
      return
    }
    setLimitNote("")
    setSelected((current) => ({ ...current, [pose.id]: view.id }))
  }

  async function generate() {
    if (!settings.apiKey.trim() && !serverKey) {
      setSettingsOpen(true)
      setRunError("先在设置里填写 API Key。")
      setSheetOpen(true)
      return
    }
    const viewIds = chosen.map((item) => item.viewId)
    if (viewIds.length === 0) return
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setRunError("")
    setResults([])
    const bodyBase = {
      provider: settings.provider,
      apiKey: settings.apiKey,
      baseURL: settings.baseURL,
      model: settings.model,
      aspectRatio: settings.aspectRatio,
      keepOutfit: settings.keepOutfit,
      extraPrompt,
      characterImages: characters.map((image) => ({ mediaType: image.mediaType, dataBase64: image.dataBase64 })),
    }
    try {
      if (settings.mode === "sheet") {
        setProgress("正在画姿势拼图")
        const batch = await requestGenerate({ ...bodyBase, mode: "sheet", viewIds }, controller.signal)
        setResults(batch)
      } else {
        const collected: ResultCard[] = []
        for (let index = 0; index < chosen.length; index += 1) {
          const item = chosen[index]
          setProgress(`正在画第 ${index + 1} 张，共 ${chosen.length} 张`)
          const batch = await requestGenerate({ ...bodyBase, mode: "each", viewIds: [item.viewId] }, controller.signal)
          collected.push(...batch.map((result, resultIndex) => ({ ...result, key: `${item.viewId}-${resultIndex}` })))
          setResults([...collected])
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setRunError("已停止。已经画完的图还留在下面。")
      else setRunError(error instanceof Error ? error.message : "生图失败")
    } finally {
      setRunning(false)
      setProgress("")
      abortRef.current = null
    }
  }

  const composer = (
    <Composer
      selected={chosen}
      onRemove={(poseId) => setSelected((current) => {
        const next = { ...current }
        delete next[poseId]
        return next
      })}
      onClear={() => setSelected({})}
      characters={characters}
      extraPrompt={extraPrompt}
      onExtraPrompt={setExtraPrompt}
      providerLabel={settings.provider === "seedream" ? "Seedream" : settings.provider === "openai" ? "OpenAI" : "Gemini"}
      aspectRatio={settings.aspectRatio}
      mode={settings.mode}
      keepOutfit={settings.keepOutfit}
      hasKey={Boolean(settings.apiKey.trim()) || serverKey}
      running={running}
      progress={progress}
      runError={runError}
      prompts={prompts}
      promptError={promptError}
      results={results}
      limitNote={limitNote}
      onGenerate={() => void generate()}
      onStop={() => abortRef.current?.abort()}
      onOpenSettings={() => setSettingsOpen(true)}
    />
  )

  return (
    <div className="min-h-dvh bg-[var(--background)] text-foreground lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/80 px-4 py-3 md:px-6">
        <WhaleMark />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none">澜姿</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">从姿势图库里挑一个或多个姿势，用澜或你自己的模特出图</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setInstallOpen(true)}>装进 Harness</Button>
        <Button variant="outline" size="icon" aria-label="生图设置" onClick={() => setSettingsOpen(true)}>
          <Settings />
        </Button>
      </header>
      <div className="lg:grid lg:h-full lg:min-h-0 lg:flex-1 lg:grid-cols-[300px_minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)]">
        <CharacterDock
          images={characters}
          onChange={updateCharacters}
          keepOutfit={settings.keepOutfit}
          onKeepOutfit={(keepOutfit) => updateSettings({ ...settings, keepOutfit })}
        />
        <main className="min-w-0 pb-24 lg:min-h-0 lg:overflow-y-auto lg:pb-8">
          <PoseBrowser
            catalog={catalog}
            loading={loading}
            error={catalogError}
            onRetry={loadCatalog}
            showAdult={settings.showAdult}
            requestedSystem={requestedSystem}
            onRequestedSystemApplied={clearRequestedSystem}
            onRequestAdult={(systemId) => setAdultAsk(systemId)}
            selected={selected}
            onToggle={togglePose}
          />
        </main>
        <aside className="hidden min-h-0 border-l border-border/80 px-4 py-5 lg:block lg:overflow-y-auto">
          {composer}
        </aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-[var(--background)]/95 p-3 backdrop-blur lg:hidden">
        <Button className="h-11 w-full" onClick={() => setSheetOpen(true)}>
          已选 {chosen.length} 个姿势 · 去生图
        </Button>
      </div>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>生图</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{composer}</div>
        </SheetContent>
      </Sheet>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} onChange={updateSettings} />
      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>装进 DeepSeek Harness</DialogTitle>
            <DialogDescription>这个目录本身就是插件包。在 Harness 项目里执行下面的命令，重启后对话里会出现「姿势」页，Agent 也能直接调用姿势生图。</DialogDescription>
          </DialogHeader>
          <pre className="overflow-auto rounded-xl bg-muted p-3 text-xs leading-5">dsh plugin --profile web add /你的路径/dsh-pose-muse</pre>
          <p className="text-xs leading-5 text-muted-foreground">密钥也可以不填在网页里，改成环境变量 POSE_MUSE_API_KEY，给对话里的 generate_pose_images 用。网页工作室和插件共用同一套姿势目录与提示词。</p>
        </DialogContent>
      </Dialog>
      <Dialog open={adultAsk !== null} onOpenChange={(open) => { if (!open) setAdultAsk(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>这些是成人向姿势</DialogTitle>
            <DialogDescription>
              来自原图库的性感系、双人缠绵，以及上半身里的大胆分类。画面仍是结构线稿。打开之后，生图默认继续保持模特的服装，只借用姿势。
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdultAsk(null)}>先不看</Button>
            <Button onClick={() => {
              if (adultAsk) setRequestedSystem(adultAsk)
              updateSettings({ ...settings, showAdult: true })
              setAdultAsk(null)
            }}>显示成人向姿势</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

async function requestGenerate(body: unknown, signal: AbortSignal): Promise<ResultCard[]> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })
  const payload = await response.json() as { results?: Array<{ viewId: string; title: string; prompt: string; ok: boolean; error?: string; mediaType?: string; imageBase64?: string; warning?: string }>; error?: string }
  if (!response.ok) throw new Error(payload.error || "生图失败")
  return (payload.results ?? []).map((item, index) => ({
    key: `${item.viewId}-${index}`,
    title: item.title,
    prompt: item.prompt,
    ok: item.ok,
    error: item.error,
    warning: item.warning,
    src: item.ok && item.imageBase64 ? `data:${item.mediaType || "image/png"};base64,${item.imageBase64}` : undefined,
  }))
}
