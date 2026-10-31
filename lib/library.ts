import { fitEdge, isStorageHigh } from "@/shared/custom.mjs"
import { openLanpose } from "@/lib/idb"

function studioPath(basePath: string, path: string) {
  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath
  return `${base}${path}`
}

export type CustomAsset = {
  id: string
  createdAt: number
  label: string
  keywords: string
  source: "upload" | "generated"
  userPrompt: string
  beautifiedPrompt: string
  adult: boolean
  mediaType: string
  image: Blob
}

export type HistorySelection = {
  poseId: string
  viewId: string
  title: string
  angle: string
}

export type HistoryEntry = {
  id: string
  createdAt: number
  title: string
  prompt: string
  extraPrompt: string
  provider: string
  model: string
  aspectRatio: string
  mode: string
  keepOutfit: boolean
  costume: { id: string; label: string; keywords: string } | null
  face?: { id: string; section: string; hair: string; label: string; keywords: string } | null
  selection: HistorySelection[]
  mediaType: string
  image: Blob
}

export type CustomWire = {
  id: string
  label: string
  keywords: string
  adult: boolean
  source: "upload" | "generated"
  userPrompt: string
  beautifiedPrompt: string
  mediaType: string
  dataBase64: string
  createdAt: number
}

type LibraryStore = "history" | "customPoses" | "customCostumes"

function asError(error: unknown) {
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return new Error("浏览器存储已满。请先删除历史或自定义参考图。")
  }
  return error instanceof Error ? error : new Error("保存失败")
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

async function withStore<T>(store: LibraryStore, mode: IDBTransactionMode, run: (objectStore: IDBObjectStore) => Promise<T> | T) {
  const db = await openLanpose()
  try {
    const tx = db.transaction(store, mode)
    const done = transactionDone(tx)
    const result = await run(tx.objectStore(store))
    await done
    return result
  } catch (error) {
    throw asError(error)
  } finally {
    db.close()
  }
}

async function listStore<T extends { createdAt: number }>(store: LibraryStore) {
  const rows = await withStore(store, "readonly", (objectStore) => requestToPromise(objectStore.getAll() as IDBRequest<T[]>))
  return rows.sort((a, b) => b.createdAt - a.createdAt)
}

export function listCustomPoses() {
  return listStore<CustomAsset>("customPoses")
}

export function listCustomCostumes() {
  return listStore<CustomAsset>("customCostumes")
}

export function listHistory() {
  return listStore<HistoryEntry>("history")
}

export function putCustomPose(asset: CustomAsset) {
  return withStore("customPoses", "readwrite", (objectStore) => objectStore.put(asset))
}

export function putCustomCostume(asset: CustomAsset) {
  return withStore("customCostumes", "readwrite", (objectStore) => objectStore.put(asset))
}

export function putHistory(entry: HistoryEntry) {
  return withStore("history", "readwrite", (objectStore) => objectStore.put(entry))
}

export function deleteCustomPose(id: string) {
  return withStore("customPoses", "readwrite", (objectStore) => objectStore.delete(id))
}

export function deleteCustomCostume(id: string) {
  return withStore("customCostumes", "readwrite", (objectStore) => objectStore.delete(id))
}

export function deleteHistory(id: string) {
  return withStore("history", "readwrite", (objectStore) => objectStore.delete(id))
}

export function clearHistory() {
  return withStore("history", "readwrite", (objectStore) => objectStore.clear())
}

export async function readStoragePressure() {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return { high: false, usage: 0, quota: 0 }
  }
  const estimate = await navigator.storage.estimate()
  const usage = estimate.usage ?? 0
  const quota = estimate.quota ?? 0
  return { high: isStorageHigh(usage, quota), usage, quota }
}

export async function fileToJpegBlob(file: Blob) {
  const bitmap = await createImageBitmap(file)
  try {
    const fitted = fitEdge(bitmap.width, bitmap.height, 2048)
    const canvas = document.createElement("canvas")
    canvas.width = fitted.width
    canvas.height = fitted.height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("无法读取这张图片")
    context.drawImage(bitmap, 0, 0, fitted.width, fitted.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86))
    if (!blob) throw new Error("无法压缩这张图片")
    return blob
  } finally {
    bitmap.close()
  }
}

export async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ""
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

export function base64ToBlob(data: string, mediaType: string) {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mediaType })
}

export async function assetToWire(asset: CustomAsset): Promise<CustomWire> {
  return {
    id: asset.id,
    label: asset.label,
    keywords: asset.keywords,
    adult: asset.adult,
    source: asset.source,
    userPrompt: asset.userPrompt,
    beautifiedPrompt: asset.beautifiedPrompt,
    mediaType: asset.mediaType,
    dataBase64: await blobToBase64(asset.image),
    createdAt: asset.createdAt,
  }
}

async function sendLibrary(basePath: string, method: "PUT" | "POST", body: string) {
  const response = await fetch(studioPath(basePath, "/api/custom-library"), {
    method,
    headers: { "content-type": "application/json" },
    body,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(payload.error || "自定义参考没有同步给 Agent")
  }
}

export async function syncCustomLibrary(basePath: string, poses: CustomAsset[], costumes: CustomAsset[]) {
  const wirePoses = await Promise.all(poses.map((item) => assetToWire(item)))
  const wireCostumes = await Promise.all(costumes.map((item) => assetToWire(item)))
  const payload = JSON.stringify({ poses: wirePoses, costumes: wireCostumes })
  if (payload.length < 10_000_000) {
    await sendLibrary(basePath, "PUT", payload)
    return
  }
  await sendLibrary(basePath, "PUT", JSON.stringify({ poses: [], costumes: [] }))
  for (const item of wirePoses) {
    await sendLibrary(basePath, "POST", JSON.stringify({ kind: "pose", item }))
  }
  for (const item of wireCostumes) {
    await sendLibrary(basePath, "POST", JSON.stringify({ kind: "costume", item }))
  }
}
