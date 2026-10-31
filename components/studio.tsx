"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useElapsedSeconds, withElapsed } from "@/lib/elapsed"
import { Settings } from "lucide-react"
import { CharacterDock } from "@/components/character-dock"
import { Composer, type ResultCard } from "@/components/composer"
import { CostumeBrowser } from "@/components/costume-browser"
import type { CustomDraft } from "@/components/custom-reference-panel"
import type { HistoryView } from "@/components/history-panel"
import { PoseBrowser } from "@/components/pose-browser"
import { SettingsDialog } from "@/components/settings-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { WhaleMark } from "@/components/whale-mark"
import { requestCharacterSheet } from "@/lib/character-client"
import { readStoredCharacters, writeStoredCharacters, type StoredCharacter } from "@/lib/characters"
import {
  assetToWire,
  base64ToBlob,
  blobToBase64,
  clearHistory,
  deleteCustomCostume,
  deleteCustomPose,
  deleteHistory,
  fileToJpegBlob,
  listCustomCostumes,
  listCustomPoses,
  listHistory,
  putCustomCostume,
  putCustomPose,
  putHistory,
  readStoragePressure,
  syncCustomLibrary,
  type CustomAsset,
  type HistoryEntry,
} from "@/lib/library"
import { deleteSavedModel, listSavedModels, putSavedModel, readActiveModelId, readBuiltinUsed, writeActiveModelId, writeBuiltinUsed, type SavedModel } from "@/lib/models"
import { getBuiltinModel } from "@/shared/builtin-models.mjs"
import { pickRandomCombo } from "@/shared/random-combo.mjs"
import { baseURLFor, DEFAULT_SETTINGS, loadSettings, modelFor, saveSettings, type StudioSettings } from "@/lib/settings"
import { StudioEnvProvider, studioUrl, useStudioEnv, type StudioPortal } from "@/lib/studio-env"
import { createCustomId, isCustomCostumeId, reuseFromHistory } from "@/shared/custom.mjs"
import { messageForStatus } from "@/shared/http-status.mjs"
import { isBuiltinModelId } from "@/shared/builtin-models.mjs"
import { DEFAULT_MODEL_ID, activateModel, adoptCurrent, deleteFromLibrary, identityImage, renameModel, switcherEntries, syncLibrary, withGeneratedSheet } from "@/shared/models.mjs"
import type { Catalog, Pose, PoseView, PromptCard } from "@/lib/types"

type Selection = Record<string, string>
type Library = "poses" | "costumes"
type CostumePick = { id: string; label: string; keywords: string }

const REPOSITORY_URL = "https://github.com/wzc520pyfm/gen-ai-pose-image"

export function Studio({
  basePath = "",
  embedded = false,
  portalContainer = null,
}: {
  basePath?: string
  embedded?: boolean
  portalContainer?: StudioPortal
}) {
  return (
    <StudioEnvProvider basePath={basePath} portalContainer={portalContainer}>
      <StudioFrame embedded={embedded} />
    </StudioEnvProvider>
  )
}

function StudioFrame({ embedded }: { embedded: boolean }) {
  const { basePath } = useStudioEnv()
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catalogError, setCatalogError] = useState("")
  const [costumeCatalog, setCostumeCatalog] = useState<Array<{ id: string; label: string; keywords: string; adult?: boolean }>>([])
  const [costumeCatalogReady, setCostumeCatalogReady] = useState(false)
  const [costumeCatalogError, setCostumeCatalogError] = useState("")
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS)
  const [library, setLibrary] = useState<Library>("poses")
  const [costume, setCostume] = useState<CostumePick | null>(null)
  const [costumeFocus, setCostumeFocus] = useState<string | null>(null)
  const [requestedSystem, setRequestedSystem] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const [adultAsk, setAdultAsk] = useState<string | null>(null)
  const [characters, setCharacters] = useState<StoredCharacter[]>([])
  const [models, setModels] = useState<SavedModel[]>([])
  const [activeModelId, setActiveModelId] = useState(DEFAULT_MODEL_ID)
  const [builtinUsed, setBuiltinUsed] = useState<Record<string, number>>({})
  const [sheetBusy, setSheetBusy] = useState(false)
  const [sheetError, setSheetError] = useState("")
  const [selected, setSelected] = useState<Selection>({})
  const [extraPrompt, setExtraPrompt] = useState("")
  const [prompts, setPrompts] = useState<PromptCard[]>([])
  const [promptError, setPromptError] = useState("")
  const [results, setResults] = useState<ResultCard[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState("")
  const waited = useElapsedSeconds(running)
  const [runError, setRunError] = useState("")
  const [limitNote, setLimitNote] = useState("")
  const [serverKey, setServerKey] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [customPoses, setCustomPoses] = useState<CustomAsset[]>([])
  const [customCostumes, setCustomCostumes] = useState<CustomAsset[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [storageHigh, setStorageHigh] = useState(false)
  const [syncWarning, setSyncWarning] = useState("")
  const [reuseNote, setReuseNote] = useState("")
  const libraryReady = useRef(false)
  const modelLoadGen = useRef(0)
  const clearRequestedSystem = useCallback(() => setRequestedSystem(null), [])
  const clearCostumeFocus = useCallback(() => setCostumeFocus(null), [])
  const abortRef = useRef<AbortController | null>(null)
  const localRetry = useRef("")

  const loadCatalog = useCallback(() => {
    setLoading(true)
    setCatalogError("")
    fetch(studioUrl(basePath, "/api/catalog"))
      .then(async (response) => {
        if (!response.ok) throw new Error("姿势目录没有加载出来")
        return response.json() as Promise<Catalog>
      })
      .then(setCatalog)
      .catch((error: unknown) => setCatalogError(error instanceof Error ? error.message : "姿势目录没有加载出来"))
      .finally(() => setLoading(false))
  }, [basePath])

  useEffect(() => { loadCatalog() }, [loadCatalog])
  useEffect(() => {
    const controller = new AbortController()
    fetch(studioUrl(basePath, "/api/costumes"), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("服装目录没有加载出来")
        return response.json() as Promise<{ costumes?: Array<{ id: string; label: string; keywords: string; adult?: boolean }> }>
      })
      .then((payload) => {
        setCostumeCatalog(Array.isArray(payload.costumes) ? payload.costumes : [])
        setCostumeCatalogError("")
        setCostumeCatalogReady(true)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setCostumeCatalogError(error instanceof Error ? error.message : "服装目录没有加载出来")
        setCostumeCatalogReady(true)
      })
    return () => controller.abort()
  }, [basePath])
  useEffect(() => {
    const local = loadSettings()
    fetch(studioUrl(basePath, "/api/status"))
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
  }, [basePath])
  useEffect(() => {
    const gen = ++modelLoadGen.current
    Promise.all([readStoredCharacters(), listSavedModels(), readActiveModelId()])
      .then(([images, saved, activeId]) => {
        if (modelLoadGen.current !== gen) return
        const adopted = adoptCurrent(saved, images, activeId || DEFAULT_MODEL_ID, Date.now())
        const active = adopted.activeId || DEFAULT_MODEL_ID
        const builtin = isBuiltinModelId(active)
        setModels(adopted.models)
        setActiveModelId(active)
        setCharacters(builtin ? [] : (adopted.models.find((model) => model.id === active)?.images as StoredCharacter[] | undefined) ?? images)
        setBuiltinUsed(readBuiltinUsed())
        if (builtin && images.length) void writeStoredCharacters([])
        if (adopted.adopted && adopted.entry) {
          void putSavedModel(adopted.entry as SavedModel)
          void writeActiveModelId(adopted.activeId)
        } else if (!activeId) {
          void writeActiveModelId(DEFAULT_MODEL_ID)
        }
      })
      .catch(() => {})
  }, [])
  useEffect(() => {
    let cancelled = false
    Promise.all([listCustomPoses(), listCustomCostumes(), listHistory(), readStoragePressure()])
      .then(([poses, costumes, entries, pressure]) => {
        if (cancelled) return
        libraryReady.current = true
        setCustomPoses(poses)
        setCustomCostumes(costumes)
        setHistory(entries)
        setStorageHigh(pressure.high)
      })
      .catch(() => {
        libraryReady.current = true
      })
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => {
    if (!libraryReady.current) return
    const timer = window.setTimeout(() => {
      syncCustomLibrary(basePath, customPoses, customCostumes)
        .then(() => setSyncWarning(""))
        .catch(() => setSyncWarning("自定义参考还没同步给 Agent。刷新工作室后再试。"))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [basePath, customPoses, customCostumes])

  function updateSettings(next: StudioSettings) {
    setSettings(next)
    saveSettings(next)
  }

  function commitLibrary(nextImages: StoredCharacter[], baseModels: SavedModel[], baseActive: string | null) {
    modelLoadGen.current += 1
    const synced = syncLibrary(baseModels, baseActive, nextImages, Date.now())
    setCharacters(nextImages)
    setModels(synced.models)
    setActiveModelId(synced.activeId || DEFAULT_MODEL_ID)
    if (synced.activeId && isBuiltinModelId(synced.activeId)) rememberBuiltin(synced.activeId)
    void writeStoredCharacters(nextImages)
    void writeActiveModelId(synced.activeId || DEFAULT_MODEL_ID)
    if (synced.removedId) void deleteSavedModel(synced.removedId)
    else if (synced.entry) void putSavedModel(synced.entry as SavedModel)
  }

  function updateCharacters(next: StoredCharacter[]) {
    setSheetError("")
    commitLibrary(next, models, activeModelId)
  }

  function rememberBuiltin(id: string) {
    const next = { ...builtinUsed, [id]: Date.now() }
    setBuiltinUsed(next)
    writeBuiltinUsed(next)
  }

  function selectSavedModel(id: string) {
    modelLoadGen.current += 1
    setSheetError("")
    if (isBuiltinModelId(id)) {
      setCharacters([])
      setActiveModelId(id)
      void writeStoredCharacters([])
      void writeActiveModelId(id)
      return
    }
    try {
      const model = activateModel(models, id)
      setCharacters(model.images as StoredCharacter[])
      setActiveModelId(model.id)
      void writeStoredCharacters(model.images as StoredCharacter[])
      void writeActiveModelId(model.id)
    } catch (error) {
      setSheetError(error instanceof Error ? error.message : "找不到这个模特")
    }
  }

  function renameSavedModel(id: string, label: string) {
    try {
      const next = renameModel(models, id, label)
      setModels(next)
      const entry = next.find((model) => model.id === id)
      if (entry) void putSavedModel(entry)
    } catch (error) {
      setSheetError(error instanceof Error ? error.message : "没有改名")
    }
  }

  function removeSavedModel(id: string) {
    const result = deleteFromLibrary(models, id, activeModelId)
    modelLoadGen.current += 1
    setModels(result.models)
    void deleteSavedModel(id)
    if (result.cleared) {
      setCharacters([])
      setActiveModelId(result.activeId || DEFAULT_MODEL_ID)
      rememberBuiltin(result.activeId || DEFAULT_MODEL_ID)
      void writeStoredCharacters([])
      void writeActiveModelId(result.activeId || DEFAULT_MODEL_ID)
    }
  }

  async function generateModelSheet() {
    if (!settings.apiKey.trim() && !serverKey) {
      setSettingsOpen(true)
      setSheetError("先在设置里填写 API Key。")
      return
    }
    const identity = identityImage(characters)
    if (!identity?.dataBase64) {
      setSheetError("先导入一张模特照片。")
      return
    }
    const startedModels = models
    const startedId = activeModelId
    const snapshot = characters
    setSheetBusy(true)
    setSheetError("")
    try {
      const image = await requestCharacterSheet(basePath, settings, {
        id: identity.id,
        mediaType: "image/jpeg",
        dataBase64: identity.dataBase64,
        role: identity.role === "sheet" ? "sheet" : "photo",
      })
      const blob = await fileToJpegBlob(base64ToBlob(image.imageBase64, image.mediaType))
      const dataBase64 = await blobToBase64(blob)
      const next = withGeneratedSheet(snapshot, {
        id: `sheet-${crypto.randomUUID()}`,
        mediaType: "image/jpeg",
        dataBase64,
        role: "sheet",
      }) as StoredCharacter[]
      commitLibrary(next, startedModels, startedId)
    } catch (error) {
      setSheetError(error instanceof Error ? error.message : "多视角 sheet 没有生成")
    } finally {
      setSheetBusy(false)
    }
  }

  const poseUrls = useBlobUrls(customPoses)
  const costumeUrls = useBlobUrls(customCostumes)
  const historyUrls = useBlobUrls(history)

  const poseById = useMemo(() => {
    const map = new Map<string, Pose>()
    catalog?.poses.forEach((pose) => map.set(pose.id, pose))
    for (const asset of customPoses) {
      map.set(asset.id, {
        id: asset.id,
        system: "自定义",
        systemId: "custom",
        code: "自定义",
        category: "自定义",
        name: asset.label,
        adult: asset.adult,
        people: 1,
        views: [{ id: asset.id, angle: "自定义", angleId: "custom", thumb: "", full: "" }],
      })
    }
    return map
  }, [catalog, customPoses])

  const chosen = useMemo(() => {
    return Object.entries(selected).flatMap(([poseId, viewId]) => {
      const pose = poseById.get(poseId)
      const view = pose?.views.find((item) => item.id === viewId)
      if (!pose || !view) return []
      return [{ poseId, viewId, title: pose.name, angle: view.angle, thumbSrc: poseUrls[poseId] }]
    })
  }, [selected, poseById, poseUrls])

  const selectionKey = chosen.map((item) => item.viewId).join("|")

  useEffect(() => {
    if (!selectionKey && !(settings.engine === "comfyui" && costume?.id)) {
      setPrompts([])
      setPromptError("")
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const viewIds = selectionKey ? selectionKey.split("|") : []
      void customReferenceBody(viewIds, costume?.id ?? "", customPoses, customCostumes).then((customReferences) => {
        if (controller.signal.aborted) return
        return fetch(studioUrl(basePath, "/api/prompt"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          engine: settings.engine,
          provider: settings.provider,
          mode: settings.mode,
          viewIds,
          keepOutfit: settings.keepOutfit,
          extraPrompt,
          characterCount: characters.length,
          builtinModelId: characters.length ? "" : activeModelId,
          costumeId: costume?.id ?? "",
          customReferences,
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
      }).catch(() => {})
    }, 280)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [basePath, selectionKey, extraPrompt, characters.length, activeModelId, costume?.id, settings.engine, settings.provider, settings.mode, settings.keepOutfit, customPoses, customCostumes])

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

  function randomizeCombo() {
    if (!catalog) {
      setLimitNote(catalogError || "姿势目录还没加载出来。")
      return
    }
    if (!costumeCatalogReady) {
      setLimitNote("服装目录还在加载。")
      return
    }
    if (costumeCatalogError && costumeCatalog.length === 0 && customCostumes.length === 0) {
      setLimitNote(costumeCatalogError)
      return
    }
    const poses = [
      ...catalog.poses,
      ...customPoses.map((asset) => ({
        id: asset.id,
        adult: asset.adult,
        views: [{ id: asset.id, angle: "自定义" }],
      })),
    ]
    const costumes = [
      ...costumeCatalog,
      ...customCostumes.map((asset) => ({
        id: asset.id,
        label: asset.label,
        keywords: asset.keywords,
        adult: asset.adult,
      })),
    ]
    const pick = pickRandomCombo({ poses, costumes, showAdult: settings.showAdult })
    if (!pick.ok || !pick.pose || !pick.view || !pick.costume) {
      setLimitNote(pick.message)
      return
    }
    setLimitNote("")
    setSelected({ [pick.pose.id]: pick.view.id })
    setCostume({ id: pick.costume.id, label: pick.costume.label, keywords: pick.costume.keywords })
  }

  async function generate() {
    if (settings.engine !== "comfyui" && !settings.apiKey.trim() && !serverKey) {
      setSettingsOpen(true)
      setRunError("先在设置里填写 API Key。")
      setSheetOpen(true)
      return
    }
    const viewIds = chosen.map((item) => item.viewId)
    if (viewIds.length === 0 && !(settings.engine === "comfyui" && costume)) return
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setRunError("")
    setResults([])
    const costumePick = costume ? { id: costume.id, label: costume.label, keywords: costume.keywords } : null
    const bodyBase = {
      engine: settings.engine,
      provider: settings.provider,
      apiKey: settings.engine === "comfyui" ? "" : settings.apiKey,
      baseURL: settings.engine === "comfyui" ? "" : settings.baseURL,
      model: settings.model,
      aspectRatio: settings.aspectRatio,
      keepOutfit: settings.keepOutfit,
      extraPrompt,
      costumeId: costume?.id ?? "",
      characterImages: characters.map((image) => ({ mediaType: image.mediaType, dataBase64: image.dataBase64 })),
      builtinModelId: characters.length ? "" : activeModelId,
    }
    const snapshotBase = {
      extraPrompt,
      provider: settings.engine === "comfyui" ? "comfyui" : settings.provider,
      model: settings.engine === "comfyui" ? "统一换装与姿势工作流" : settings.model,
      aspectRatio: settings.aspectRatio,
      mode: settings.mode,
      keepOutfit: costume ? false : settings.keepOutfit,
      costume: costumePick,
    }
    try {
      if (settings.mode === "sheet" || chosen.length === 0) {
        setProgress(chosen.length === 0 ? "正在本机换装" : settings.engine === "comfyui" ? "正在逐格生成姿势拼图" : "正在画姿势拼图")
        const customReferences = await customReferenceBody(viewIds, costume?.id ?? "", customPoses, customCostumes)
        const localRunId = localRetry.current || crypto.randomUUID()
        const batch = await requestGenerate(basePath, { ...bodyBase, mode: settings.mode, viewIds, customReferences, localRunId }, controller.signal)
        localRetry.current = settings.engine === "comfyui" && batch.some((item) => !item.ok) ? localRunId : ""
        setResults(batch)
        await rememberResults(batch, { ...snapshotBase, selection: chosen })
      } else {
        const collected: ResultCard[] = []
        for (let index = 0; index < chosen.length; index += 1) {
          const item = chosen[index]
          setProgress(`正在画第 ${index + 1} 张，共 ${chosen.length} 张`)
          const customReferences = await customReferenceBody([item.viewId], costume?.id ?? "", customPoses, customCostumes)
          const batch = await requestGenerate(basePath, { ...bodyBase, mode: "each", viewIds: [item.viewId], customReferences }, controller.signal)
          const stamped = batch.map((result, resultIndex) => ({ ...result, key: `${item.viewId}-${resultIndex}` }))
          collected.push(...stamped)
          setResults([...collected])
          await rememberResults(stamped, { ...snapshotBase, mode: "each", selection: [item] })
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

  async function rememberResults(batch: ResultCard[], snapshot: {
    extraPrompt: string
    provider: string
    model: string
    aspectRatio: string
    mode: string
    keepOutfit: boolean
    costume: { id: string; label: string; keywords: string } | null
    selection: Array<{ poseId: string; viewId: string; title: string; angle: string }>
  }) {
    for (const result of batch) {
      if (!result.ok || !result.src) continue
      try {
        const image = await fileToJpegBlob(await (await fetch(result.src)).blob())
        const entry: HistoryEntry = {
          id: `history-${crypto.randomUUID()}`,
          createdAt: Date.now(),
          title: result.title,
          prompt: result.prompt,
          extraPrompt: snapshot.extraPrompt,
          provider: snapshot.provider,
          model: snapshot.model,
          aspectRatio: snapshot.aspectRatio,
          mode: snapshot.mode,
          keepOutfit: snapshot.keepOutfit,
          costume: snapshot.costume,
          selection: result.viewId && !result.viewId.includes(",") ? snapshot.selection.filter((item) => item.viewId === result.viewId) : snapshot.selection,
          mediaType: "image/jpeg",
          image,
        }
        await putHistory(entry)
        setHistory((current) => [entry, ...current])
      } catch (error) {
        setStorageHigh(true)
        setRunError(error instanceof Error ? error.message : "成图没有写入历史")
      }
    }
    const pressure = await readStoragePressure().catch(() => null)
    if (pressure?.high) setStorageHigh(true)
  }

  async function saveCustom(kind: "pose" | "costume", draft: CustomDraft) {
    const asset: CustomAsset = {
      id: createCustomId(kind),
      createdAt: Date.now(),
      label: draft.label,
      keywords: draft.keywords,
      source: draft.source,
      userPrompt: draft.userPrompt,
      beautifiedPrompt: draft.beautifiedPrompt,
      adult: draft.adult,
      mediaType: draft.mediaType,
      image: draft.blob,
    }
    if (kind === "pose") {
      await putCustomPose(asset)
      setCustomPoses((current) => [asset, ...current])
    } else {
      await putCustomCostume(asset)
      setCustomCostumes((current) => [asset, ...current])
    }
    const pressure = await readStoragePressure().catch(() => null)
    if (pressure?.high) setStorageHigh(true)
  }

  async function removeCustomPose(id: string) {
    await deleteCustomPose(id)
    setCustomPoses((current) => current.filter((item) => item.id !== id))
    setSelected((current) => {
      if (!current[id]) return current
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  async function removeCustomCostume(id: string) {
    await deleteCustomCostume(id)
    setCustomCostumes((current) => current.filter((item) => item.id !== id))
    setCostume((current) => current?.id === id ? null : current)
  }

  function reuse(entry: HistoryView) {
    updateSettings({ ...settings, engine: entry.provider === "comfyui" ? "comfyui" : "cloud" })
    const restored = reuseFromHistory(entry)
    const missingPose = entry.selection.some((item) => !poseById.has(item.poseId))
    const missingCostume = Boolean(restored.costume && isCustomCostumeId(restored.costume.id) && !customCostumes.some((item) => item.id === restored.costume?.id))
    setSelected(restored.selected)
    setExtraPrompt(restored.extraPrompt)
    setCostume(restored.costume)
    setReuseNote(missingPose || missingCostume
      ? "已恢复还能找到的选择。有的自定义参考已经删除，请重新上传或生成后再出图。"
      : "已恢复那次的姿势和描述，可以再次生图。")
    if (window.innerWidth < 1024) setSheetOpen(true)
  }

  const historyViews: HistoryView[] = history.map((entry) => ({
    id: entry.id,
    createdAt: entry.createdAt,
    title: entry.title,
    prompt: entry.prompt,
    extraPrompt: entry.extraPrompt,
    provider: entry.provider,
    model: entry.model,
    aspectRatio: entry.aspectRatio,
    mode: entry.mode,
    keepOutfit: entry.keepOutfit,
    costume: entry.costume,
    selection: entry.selection,
    thumbUrl: historyUrls[entry.id] || "",
  }))
  const customPoseCards = customPoses.map((asset) => ({
    id: asset.id,
    label: asset.label,
    keywords: asset.keywords,
    adult: asset.adult,
    thumbUrl: poseUrls[asset.id] || "",
  }))
  const customCostumeCards = customCostumes.map((asset) => ({
    id: asset.id,
    label: asset.label,
    keywords: asset.keywords,
    adult: asset.adult,
    thumbUrl: costumeUrls[asset.id] || "",
  }))

  const composer = (
    <Composer
      selected={chosen}
      onRemove={(poseId) => setSelected((current) => {
        const next = { ...current }
        delete next[poseId]
        return next
      })}
      onClear={() => setSelected({})}
      onRandom={randomizeCombo}
      characters={characters}
      extraPrompt={extraPrompt}
      onExtraPrompt={setExtraPrompt}
      localMode={settings.engine === "comfyui"}
      providerLabel={settings.engine === "comfyui" ? "ComfyUI 本地" : settings.provider === "seedream" ? "Seedream" : settings.provider === "openai" ? "OpenAI" : "Gemini"}
      aspectRatio={settings.aspectRatio}
      mode={settings.mode}
      keepOutfit={settings.keepOutfit}
      costume={costume ? { ...costume, thumbSrc: costumeUrls[costume.id] } : null}
      onClearCostume={() => setCostume(null)}
      hasKey={settings.engine === "comfyui" || Boolean(settings.apiKey.trim()) || serverKey}
      running={running}
      progress={withElapsed(progress, waited)}
      runError={runError}
      prompts={prompts}
      promptError={promptError}
      results={results}
      limitNote={limitNote}
      onGenerate={() => void generate()}
      onStop={() => abortRef.current?.abort()}
      onOpenSettings={() => setSettingsOpen(true)}
      history={historyViews}
      onReuseHistory={reuse}
      onDeleteHistory={(id) => {
        void deleteHistory(id).then(() => setHistory((current) => current.filter((item) => item.id !== id))).catch((error: unknown) => {
          setRunError(error instanceof Error ? error.message : "没有删掉这条历史")
        })
      }}
      onClearHistory={() => {
        void clearHistory().then(() => setHistory([])).catch((error: unknown) => {
          setRunError(error instanceof Error ? error.message : "没有清空历史")
        })
      }}
      reuseNote={reuseNote}
      builtinName={getBuiltinModel(activeModelId)?.name || "大肥鱼"}
      builtinSheet={getBuiltinModel(activeModelId)?.sheet || "/muse/dafeiyu-sheet.png"}
    />
  )

  return (
    <div className={`@container/studio flex min-h-0 flex-col overflow-hidden bg-background text-foreground ${embedded ? "h-full" : "h-dvh"}`}>
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-white px-3 py-2 @min-[640px]/studio:px-4 @min-[768px]/studio:px-5">
        <WhaleMark className="size-8 shrink-0" />
        <h1 className="shrink-0 text-base font-semibold">澜姿</h1>
        <div className="flex shrink-0 rounded-lg bg-muted p-1" role="tablist" aria-label="图库">
          <button
            type="button"
            role="tab"
            aria-selected={library === "poses"}
            onClick={() => setLibrary("poses")}
            className={`rounded-md px-3 py-1 text-sm whitespace-nowrap ${library === "poses" ? "bg-white font-medium shadow-sm" : "text-muted-foreground"}`}
          >
            姿势
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={library === "costumes"}
            onClick={() => setLibrary("costumes")}
            className={`rounded-md px-3 py-1 text-sm whitespace-nowrap ${library === "costumes" ? "bg-white font-medium shadow-sm" : "text-muted-foreground"}`}
          >
            服装
          </button>
        </div>
        {costume ? <span className="hidden min-w-0 truncate text-sm text-primary @min-[640px]/studio:inline">{costume.id}</span> : null}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" className="@max-[640px]/studio:hidden" onClick={() => setInstallOpen(true)}>装进 Harness</Button>
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="打开 GitHub 仓库"
            className={buttonVariants({ variant: "outline", size: "icon" })}
          >
            <GithubMark />
          </a>
          <Button variant="outline" size="icon" aria-label="生图设置" onClick={() => setSettingsOpen(true)}>
            <Settings />
          </Button>
        </div>
      </header>
      {storageHigh ? (
        <p className="shrink-0 border-b bg-amber-50 px-4 py-2 text-sm text-amber-950">
          本机存储快满了。可以删除历史或自定义参考图。
          <button type="button" className="ml-2 underline" onClick={() => void clearHistory().then(() => setHistory([])).then(() => readStoragePressure()).then((pressure) => setStorageHigh(pressure.high))}>清空历史</button>
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col @min-[1024px]/studio:grid @min-[1024px]/studio:grid-cols-[300px_minmax(0,1fr)_340px] @min-[1024px]/studio:grid-rows-[minmax(0,1fr)]">
        <CharacterDock
          images={characters}
          onChange={updateCharacters}
          keepOutfit={settings.keepOutfit}
          onKeepOutfit={(keepOutfit) => updateSettings({ ...settings, keepOutfit })}
          outfitLocked={Boolean(costume)}
          switchItems={switcherEntries({ models }).map((item) => {
            const saved = models.find((model) => model.id === item.id)
            const thumb = saved?.images[0]
            return {
              id: item.id,
              label: item.label,
              builtin: item.builtin,
              thumbSrc: thumb
                ? `data:${thumb.mediaType};base64,${thumb.dataBase64}`
                : studioUrl(basePath, item.portrait || "/muse/dafeiyu-portrait.jpg"),
            }
          })}
          activeModelId={activeModelId}
          activeLabel={models.find((model) => model.id === activeModelId)?.label ?? ""}
          onSelectModel={selectSavedModel}
          onRenameModel={renameSavedModel}
          onDeleteModel={removeSavedModel}
          onGenerateSheet={() => void generateModelSheet()}
          sheetBusy={sheetBusy}
          sheetError={sheetError}
          hasKey={Boolean(settings.apiKey.trim()) || serverKey}
          onOpenSettings={() => {
            setSheetError(settings.engine === "comfyui"
              ? "多视角 sheet 要用云端生图。请先选 Seedream、Gemini 或 OpenAI，并填写 API Key。"
              : "先在设置里填写 API Key。")
            setSettingsOpen(true)
          }}
        />
        <main className="order-2 min-h-0 min-w-0 flex-1 overflow-y-auto @min-[1024px]/studio:order-none @min-[1024px]/studio:pb-8">
          {library === "poses" ? (
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
              customPoses={customPoseCards}
              onSaveCustom={(draft) => saveCustom("pose", draft)}
              onDeleteCustom={(id) => void removeCustomPose(id)}
              settings={settings}
              hasKey={Boolean(settings.apiKey.trim()) || serverKey}
              syncWarning={syncWarning}
            />
          ) : (
            <CostumeBrowser
              showAdult={settings.showAdult}
              focusCategory={costumeFocus}
              onFocusApplied={clearCostumeFocus}
              onRequestAdult={(categoryId) => setAdultAsk(`costume:${categoryId}`)}
              selectedId={costume?.id ?? null}
              onSelect={(item) => setCostume((current) => current?.id === item.id ? null : { id: item.id, label: item.label, keywords: item.keywords })}
              customCostumes={customCostumeCards}
              onSaveCustom={(draft) => saveCustom("costume", draft)}
              onDeleteCustom={(id) => void removeCustomCostume(id)}
              settings={settings}
              hasKey={Boolean(settings.apiKey.trim()) || serverKey}
              syncWarning={syncWarning}
            />
          )}
        </main>
        <aside className="hidden min-h-0 border-l bg-white px-4 py-5 @min-[1024px]/studio:block @min-[1024px]/studio:overflow-y-auto">
          {composer}
        </aside>
      </div>
      <div className="shrink-0 border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] @min-[1024px]/studio:hidden">
        <Button className="h-11 w-full" onClick={() => setSheetOpen(true)}>
          已选 {chosen.length} 个姿势{costume ? ` · ${costume.id}` : ""} · 去生图
        </Button>
      </div>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[min(85dvh,85%)] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>生图</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{composer}</div>
        </SheetContent>
      </Sheet>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} onChange={updateSettings} />
      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent className="max-w-[min(32rem,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle>装进 DeepSeek Harness</DialogTitle>
            <DialogDescription>澜姿发布在 npm，包名是 gen-ai-pose-image。在已经装好 Harness 的机器上执行下面的命令，重启后左侧栏会出现「澜姿 / 工作室」，Agent 也能直接调用姿势生图。</DialogDescription>
          </DialogHeader>
          <pre className="overflow-auto rounded-xl bg-muted p-3 text-xs leading-5">dsh plugin --profile web add gen-ai-pose-image</pre>
          <p className="text-xs leading-5 text-muted-foreground">网页工作室要在设置里填自己的 API Key。Harness 插件出图时，用启动环境里的 POSE_MUSE_API_KEY。</p>
        </DialogContent>
      </Dialog>
      <Dialog open={adultAsk !== null} onOpenChange={(open) => { if (!open) setAdultAsk(null) }}>
        <DialogContent className="max-w-[min(28rem,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle>{adultAsk === "custom" || adultAsk === "costume:custom" ? "这些是成人向自定义参考" : adultAsk?.startsWith("costume:") ? "这些是成人向服装" : "这些是成人向姿势"}</DialogTitle>
            <DialogDescription>
              {adultAsk === "custom" || adultAsk === "costume:custom"
                ? "自定义参考里标成成人向的图默认不显示。打开之后才能点选。生图仍要求角色是成年人。"
                : adultAsk?.startsWith("costume:")
                ? "内衣、泳装和性感分类里的图仍然没有人物，只是衣服本身更暴露。打开之后可以点选。生图会换成这套衣服，并保留角色的脸、头发、鲸耳和鲸尾。"
                : "来自原图库的性感系、双人缠绵，以及上半身里的大胆分类。画面仍是结构线稿。打开之后，生图默认继续保持模特的服装，只借用姿势。"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdultAsk(null)}>先不看</Button>
            <Button onClick={() => {
              if (adultAsk?.startsWith("costume:")) {
                setCostumeFocus(adultAsk.slice("costume:".length))
                setLibrary("costumes")
              } else if (adultAsk) {
                setRequestedSystem(adultAsk)
              }
              updateSettings({ ...settings, showAdult: true })
              setAdultAsk(null)
            }}>{adultAsk?.startsWith("costume:") ? "显示成人向服装" : "显示成人向姿势"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}

function useBlobUrls(items: Array<{ id: string; image: Blob }>) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    const created: Record<string, string> = {}
    for (const item of items) created[item.id] = URL.createObjectURL(item.image)
    setUrls(created)
    return () => {
      for (const url of Object.values(created)) URL.revokeObjectURL(url)
    }
  }, [items])
  return urls
}

async function customReferenceBody(viewIds: string[], costumeId: string, poses: CustomAsset[], costumes: CustomAsset[]) {
  const poseAssets = poses.filter((item) => viewIds.includes(item.id))
  const costumeAsset = costumes.find((item) => item.id === costumeId)
  return {
    poses: await Promise.all(poseAssets.map((item) => assetToWire(item))),
    costumes: costumeAsset ? [await assetToWire(costumeAsset)] : [],
  }
}

async function requestGenerate(basePath: string, body: unknown, signal: AbortSignal): Promise<ResultCard[]> {
  const response = await fetch(studioUrl(basePath, "/api/generate"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })
  const text = await response.text()
  if (!response.ok) throw new Error(messageForStatus(response.status, text, "生图失败"))
  let payload: { results?: Array<{ viewId: string; title: string; prompt: string; ok: boolean; error?: string; mediaType?: string; imageBase64?: string; warning?: string }> }
  try {
    payload = JSON.parse(text) as typeof payload
  } catch {
    throw new Error("生图失败")
  }
  return (payload.results ?? []).map((item, index) => ({
    viewId: item.viewId,
    key: `${item.viewId}-${index}`,
    title: item.title,
    prompt: item.prompt,
    ok: item.ok,
    error: item.error,
    warning: item.warning,
    src: item.ok && item.imageBase64 ? `data:${item.mediaType || "image/png"};base64,${item.imageBase64}` : undefined,
  }))
}
