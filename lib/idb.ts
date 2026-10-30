const DB_NAME = "lanpose"
const DB_VERSION = 3

export function openLanpose(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains("characters")) db.createObjectStore("characters")
      if (!db.objectStoreNames.contains("history")) db.createObjectStore("history", { keyPath: "id" })
      if (!db.objectStoreNames.contains("customPoses")) db.createObjectStore("customPoses", { keyPath: "id" })
      if (!db.objectStoreNames.contains("customCostumes")) db.createObjectStore("customCostumes", { keyPath: "id" })
      if (!db.objectStoreNames.contains("models")) db.createObjectStore("models", { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
