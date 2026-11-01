"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useElapsedSeconds, withElapsed } from "@/lib/elapsed"
import { comfyPromptCards, requestComfyGenerate, type ComfyItem } from "@/lib/comfyui-client"
import { CharacterDock } from "@/components/character-dock"
import { Composer, type ResultCard } from "@/components/composer"
import { CostumeBrowser } from "@/components/costume-browser"
import { FaceBrowser, type FaceItem } from "@/components/face-browser"
import type { CustomDraft } from "@/components/custom-reference-panel"
import type { HistoryView } from "@/components/history-panel"
import { PoseBrowser } from "@/components/pose-browser"
import { SettingsDialog } from "@/components/settings-dialog"
import { LibraryTabs } from "@/components/studio-library-tabs"
import { StudioShell } from "@/components/studio-shell"
import { Button, Modal, Sheet, buttonVariants } from "@heroui/react"
import { retireStudioLayout } from "@/lib/studio-layout"
import { useOverlayPortal } from "@/lib/studio-env"
import { useStudioTheme } from "@/lib/use-studio-theme"
import { useStudioWide } from "@/lib/use-studio-wide"
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
import type { Catalog, GeneratedResult, Pose, PoseView, PromptCard } from "@/lib/types"

type Selection = Record<string, string>
type Library = "poses" | "costumes" | "faces"
type CostumePick = { id: string; label: string; keywords: string }
type FacePick = { id: string; section: string; hair: string; label: string; keywords: string }

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
  const portal = useOverlayPortal()
  const studioRef = useRef<HTMLDivElement>(null)
  const wide = useStudioWide(studioRef)
  const { resolved: theme, toggle: toggleTheme } = useStudioTheme()
  useEffect(() => { retireStudioLayout() }, [])
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catalogError, setCatalogError] = useState("")
  const [costumeCatalog, setCostumeCatalog] = useState<Array<{ id: string; label: string; keywords: string; adult?: boolean }>>([])
  const [costumeCatalogReady, setCostumeCatalogReady] = useState(false)
  const [costumeCatalogError, setCostumeCatalogError] = useState("")
  const [faceCatalog, setFaceCatalog] = useState<FacePick[]>([])
  const [faceCatalogReady, setFaceCatalogReady] = useState(false)
  const [faceCatalogError, setFaceCatalogError] = useState("")
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS)
  const [settingsReady, setSettingsReady] = useState(false)
  const [library, setLibrary] = useState<Library>("poses")
  const [costume, setCostume] = useState<CostumePick | null>(null)
  const [face, setFace] = useState<FacePick | null>(null)
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
  const settingsRevision = useRef(0)

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
    const controller = new AbortController()
    fetch(studioUrl(basePath, "/api/faces"), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("脸部目录没有加载出来")
        return response.json() as Promise<{ faces?: FacePick[] }>
      })
      .then((payload) => {
        setFaceCatalog(Array.isArray(payload.faces) ? payload.faces : [])
        setFaceCatalogError("")
        setFaceCatalogReady(true)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setFaceCatalogError(error instanceof Error ? error.message : "脸部目录没有加载出来")
        setFaceCatalogReady(true)
      })
    return () => controller.abort()
  }, [basePath])
  useEffect(() => {
    const local = loadSettings()
    setSettings(local)
    setSettingsReady(true)
    const revision = settingsRevision.current
    fetch(studioUrl(basePath, "/api/status"))
      .then((response) => response.json())
      .then((payload: { keyConfigured?: boolean; provider?: string; model?: string; baseURL?: string }) => {
        setServerKey(Boolean(payload.keyConfigured))
        const untouched = local.provider === "gemini" && local.apiKey.trim() === "" && (local.model === modelFor("gemini") || local.model.trim() === "")
        if (untouched && payload.provider === "seedream" && settingsRevision.current === revision) {
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
      })
      .catch(() => {})
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
    if (!libraryReady.current || !settingsReady || settings.engine === "comfyui") {
      setSyncWarning("")
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      syncCustomLibrary(basePath, customPoses, customCostumes, controller.signal)
        .then(() => setSyncWarning(""))
        .catch(() => setSyncWarning("自定义参考还没同步给 Agent。刷新工作室后再试。"))
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [basePath, customPoses, customCostumes, settingsReady, settings.engine])

  function updateSettings(next: StudioSettings) {
    settingsRevision.current += 1
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

  const comfyItems = useCallback((viewIds: string[]): ComfyItem[] => {
    if (!viewIds.length && costume) return [{ viewId: "outfit", title: "仅换装", pose: null }]
    return viewIds.map((id) => {
      for (const pose of poseById.values()) {
        const view = pose.views.find((v) => v.id === id)
        if (view) return { viewId: id, title: `${pose.name} · ${view.angle}`, pose: { ...pose, angle: view.angle } }
      }
      throw new Error(`找不到姿势 ${id}`)
    })
  }, [poseById, costume])

  const selectionKey = chosen.map((item) => item.viewId).join("|")

  useEffect(() => {
    if (!selectionKey && !(settings.engine === "comfyui" && costume?.id)) {
      setPrompts([])
      setPromptError("")
      return
    }
    if (settings.engine === "comfyui") {
      try {
        setPrompts(comfyPromptCards({ items: comfyItems(selectionKey ? selectionKey.split("|") : []), costume, face, extraPrompt, characterCount: characters.length || 1, keepOutfit: costume ? false : settings.keepOutfit, mode: settings.mode }))
        setPromptError("")
      } catch (error) { setPromptError(error instanceof Error ? error.message : "提示词没有生成") }
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
          faceId: face?.id ?? "",
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
  }, [basePath, selectionKey, extraPrompt, characters.length, activeModelId, costume?.id, face, settings.engine, settings.provider, settings.mode, settings.keepOutfit, customPoses, customCostumes, comfyItems, costume])

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
    if (!faceCatalogReady) {
      setLimitNote("脸部目录还在加载。")
      return
    }
    if (costumeCatalogError && costumeCatalog.length === 0 && customCostumes.length === 0) {
      setLimitNote(costumeCatalogError)
      return
    }
    if (faceCatalogError && faceCatalog.length === 0) {
      setLimitNote(faceCatalogError)
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
    const pick = pickRandomCombo({ poses, costumes, faces: faceCatalog, showAdult: settings.showAdult })
    if (!pick.ok || !pick.pose || !pick.view || !pick.costume || !pick.face) {
      setLimitNote(pick.message)
      return
    }
    setLimitNote("")
    setSelected({ [pick.pose.id]: pick.view.id })
    setCostume({ id: pick.costume.id, label: pick.costume.label, keywords: pick.costume.keywords })
    setFace({
      id: pick.face.id,
      section: pick.face.section ?? "",
      hair: pick.face.hair ?? "",
      label: pick.face.label ?? "",
      keywords: pick.face.keywords ?? "",
    })
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
      faceId: face?.id ?? "",
      characterImages: characters.map((image) => ({ mediaType: image.mediaType, dataBase64: image.dataBase64 })),
      builtinModelId: characters.length ? "" : activeModelId,
    }
    const generateRequest = async (ids: string[], mode: StudioSettings["mode"]) => {
      const customReferences = await customReferenceBody(ids, costume?.id ?? "", customPoses, customCostumes)
      if (settings.engine === "comfyui") {
        return resultCards(await requestComfyGenerate(basePath, settings, { ...bodyBase, mode, items: comfyItems(ids), costume, face, customReferences }, controller.signal))
      }
      return requestGenerate(basePath, { ...bodyBase, mode, viewIds: ids, customReferences }, controller.signal)
    }
    const snapshotBase = {
      extraPrompt,
      provider: settings.engine === "comfyui" ? "comfyui" : settings.provider,
      model: settings.engine === "comfyui" ? "统一换装与姿势工作流" : settings.model,
      aspectRatio: settings.aspectRatio,
      mode: settings.mode,
      keepOutfit: costume ? false : settings.keepOutfit,
      costume: costumePick,
      face: face ? { id: face.id, section: face.section, hair: face.hair, label: face.label, keywords: face.keywords } : null,
    }
    try {
      if (settings.mode === "sheet" || chosen.length === 0) {
        setProgress(chosen.length === 0 ? "正在通过 ComfyUI 换装" : settings.engine === "comfyui" ? "正在逐格生成姿势拼图" : "正在画姿势拼图")
        const batch = await generateRequest(viewIds, settings.mode)
        setResults(batch)
        await rememberResults(batch, { ...snapshotBase, selection: chosen })
      } else {
        const collected: ResultCard[] = []
        for (let index = 0; index < chosen.length; index += 1) {
          const item = chosen[index]
          setProgress(`正在画第 ${index + 1} 张，共 ${chosen.length} 张`)
          const batch = await generateRequest([item.viewId], "each")
          const stamped = batch.map((result, resultIndex) => ({ ...result, key: `${item.viewId}-${resultIndex}` }))
          collected.push(...stamped)
          setResults([...collected])
          await rememberResults(stamped, { ...snapshotBase, mode: "each", selection: [item] })
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") setRunError("已停止。")
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
    face: FacePick | null
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
          face: snapshot.face,
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
    setFace(restored.face)
    setReuseNote(missingPose || missingCostume
      ? "已恢复还能找到的选择。有的自定义参考已经删除，请重新上传或生成后再出图。"
      : "已恢复那次的姿势和描述，可以再次生图。")
    if (!wide) setSheetOpen(true)
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
    face: entry.face ?? null,
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
      providerLabel={settings.engine === "comfyui" ? "ComfyUI" : settings.provider === "seedream" ? "Seedream" : settings.provider === "openai" ? "OpenAI" : "Gemini"}
      aspectRatio={settings.aspectRatio}
      mode={settings.mode}
      keepOutfit={settings.keepOutfit}
      costume={costume ? { ...costume, thumbSrc: costumeUrls[costume.id] } : null}
      onClearCostume={() => setCostume(null)}
      face={face}
      onClearFace={() => setFace(null)}
      hasKey={settings.engine === "comfyui" || Boolean(settings.apiKey.trim()) || serverKey}
      running={running}
      progress={withElapsed(progress, waited)}
      elapsed={waited}
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

  const libraryTabs = (
    <>
      <LibraryTabs library={library} onLibrary={setLibrary} />
      {face ? <span className="hidden min-w-0 truncate text-sm text-primary @min-[640px]/studio:inline">{face.id}</span> : null}
      {costume ? <span className="hidden min-w-0 truncate text-sm text-primary @min-[640px]/studio:inline">{costume.id}</span> : null}
    </>
  )

  const libraryPane = library === "faces" ? (
    <FaceBrowser
      selectedId={face?.id ?? null}
      onSelect={(item: FaceItem) => setFace((current) => current?.id === item.id ? null : {
        id: item.id,
        section: item.section,
        hair: item.hair,
        label: item.label,
        keywords: item.keywords,
      })}
    />
  ) : library === "poses" ? (
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
      onChangeSettings={updateSettings}
    />
  )

  const characterDock = (
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
  )

  const headerTrailing = (
    <>
      <Button variant="outline" size="sm" className="@max-[640px]/studio:hidden" onPress={() => setInstallOpen(true)}>装进 Harness</Button>
      <a
        href={REPOSITORY_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="打开 GitHub 仓库"
        className={buttonVariants({ variant: "outline", size: "sm", isIconOnly: true })}
      >
        <GithubMark />
      </a>
    </>
  )

  const mobileWorkOrderTrigger = (
    <>
      <div className="shrink-0 border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] @min-[1024px]/studio:hidden">
        <Button className="h-11 w-full" onPress={() => setSheetOpen(true)}>
          已选 {chosen.length} 个姿势{face ? ` · ${face.id}` : ""}{costume ? ` · ${costume.id}` : ""} · 去生图
        </Button>
      </div>
      <Sheet isOpen={sheetOpen} onOpenChange={setSheetOpen} placement="bottom">
        <Sheet.Backdrop {...portal}>
          <Sheet.Content className="max-h-[min(85dvh,85%)] rounded-t-3xl">
            <Sheet.Dialog>
              <Sheet.Handle />
              <Sheet.CloseTrigger />
              <Sheet.Header>
                <Sheet.Heading>生图</Sheet.Heading>
              </Sheet.Header>
              <Sheet.Body className="overflow-y-auto px-4 pb-6">{composer}</Sheet.Body>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
    </>
  )

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden bg-background text-foreground ${embedded ? "h-full" : "h-dvh"}`}>
      {storageHigh ? (
        <p className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
          本机存储快满了。可以删除历史或自定义参考图。
          <button type="button" className="ml-2 underline" onClick={() => void clearHistory().then(() => setHistory([])).then(() => readStoragePressure()).then((pressure) => setStorageHigh(pressure.high))}>清空历史</button>
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-hidden">
        <StudioShell
          embedded
          containerRef={studioRef}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setSettingsOpen(true)}
          libraryTabs={libraryTabs}
          headerTrailing={headerTrailing}
          mobileWorkOrderTrigger={mobileWorkOrderTrigger}
          regions={{
            characterDock,
            library: libraryPane,
            workOrder: composer,
          }}
        />
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} onChange={updateSettings} />
      <Modal.Backdrop isOpen={installOpen} onOpenChange={setInstallOpen} {...portal}>
        <Modal.Container>
          <Modal.Dialog className="max-w-[min(32rem,calc(100%-2rem))]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>装进 DeepSeek Harness</Modal.Heading>
              <p className="text-sm text-muted-foreground">澜姿发布在 npm，包名是 gen-ai-pose-image。在已经装好 Harness 的机器上执行下面的命令，重启后左侧栏会出现「澜姿 / 工作室」，Agent 也能直接调用姿势生图。</p>
            </Modal.Header>
            <Modal.Body className="grid gap-3">
              <pre className="overflow-auto rounded-xl bg-secondary p-3 text-xs leading-5">dsh plugin --profile web add gen-ai-pose-image</pre>
              <p className="text-xs leading-5 text-muted-foreground">网页工作室要在设置里填自己的 API Key。Harness 插件出图时，用启动环境里的 POSE_MUSE_API_KEY。</p>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <Modal.Backdrop isOpen={adultAsk !== null} onOpenChange={(open) => { if (!open) setAdultAsk(null) }} {...portal}>
        <Modal.Container>
          <Modal.Dialog className="max-w-[min(28rem,calc(100%-2rem))]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{adultAsk === "custom" || adultAsk === "costume:custom" ? "这些是成人向自定义参考" : adultAsk?.startsWith("costume:") ? "这些是成人向服装" : "这些是成人向姿势"}</Modal.Heading>
              <p className="text-sm text-muted-foreground">
                {adultAsk === "custom" || adultAsk === "costume:custom"
                  ? "自定义参考里标成成人向的图默认不显示。打开之后才能点选。生图仍要求角色是成年人。"
                  : adultAsk?.startsWith("costume:")
                  ? "内衣、泳装和性感分类里的图仍然没有人物，只是衣服本身更暴露。打开之后可以点选。生图会换成这套衣服，并保留角色的脸、头发、鲸耳和鲸尾。"
                  : "来自原图库的性感系、双人缠绵，以及上半身里的大胆分类。画面仍是结构线稿。打开之后，生图默认继续保持模特的服装，只借用姿势。"}
              </p>
            </Modal.Header>
            <Modal.Footer>
              <Button variant="outline" onPress={() => setAdultAsk(null)}>先不看</Button>
              <Button onPress={() => {
                if (adultAsk?.startsWith("costume:")) {
                  setCostumeFocus(adultAsk.slice("costume:".length))
                  setLibrary("costumes")
                } else if (adultAsk) {
                  setRequestedSystem(adultAsk)
                }
                updateSettings({ ...settings, showAdult: true })
                setAdultAsk(null)
              }}>{adultAsk?.startsWith("costume:") ? "显示成人向服装" : "显示成人向姿势"}</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
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
  return resultCards(payload.results ?? [])
}

function resultCards(results: GeneratedResult[]): ResultCard[] {
  return results.map((item, index) => ({
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
