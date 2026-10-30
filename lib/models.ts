import type { SavedModel as SharedSavedModel } from "@/shared/models.mjs"
import { openLanpose } from "@/lib/idb"

export type SavedModel = SharedSavedModel

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withDb<T>(store: string, mode: IDBTransactionMode, run: (objectStore: IDBObjectStore, done: Promise<void>) => Promise<T>) {
  const db = await openLanpose()
  try {
    const tx = db.transaction(store, mode)
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    return await run(tx.objectStore(store), done)
  } finally {
    db.close()
  }
}

export async function listSavedModels() {
  const rows = await withDb("models", "readonly", async (store, done) => {
    const result = await requestToPromise(store.getAll() as IDBRequest<SavedModel[]>)
    await done
    return result
  })
  return rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || String(a.id).localeCompare(String(b.id)))
}

export async function putSavedModel(model: SavedModel) {
  await withDb("models", "readwrite", async (store, done) => {
    store.put(model)
    await done
  })
}

export async function deleteSavedModel(id: string) {
  await withDb("models", "readwrite", async (store, done) => {
    store.delete(id)
    await done
  })
}

export async function readActiveModelId() {
  const value = await withDb("characters", "readonly", async (store, done) => {
    const result = await requestToPromise(store.get("activeModelId"))
    await done
    return result
  })
  return typeof value === "string" && value ? value : null
}

const BUILTIN_USED_KEY = "lanpose-builtin-used-v1"

export function readBuiltinUsed() {
  if (typeof window === "undefined") return {} as Record<string, number>
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BUILTIN_USED_KEY) || "{}") as Record<string, unknown>
    const next: Record<string, number> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value)) next[key] = value
    }
    return next
  } catch {
    return {}
  }
}

export function writeBuiltinUsed(value: Record<string, number>) {
  window.localStorage.setItem(BUILTIN_USED_KEY, JSON.stringify(value))
}

export async function writeActiveModelId(id: string | null) {
  await withDb("characters", "readwrite", async (store, done) => {
    if (id) store.put(id, "activeModelId")
    else store.delete("activeModelId")
    await done
  })
}
