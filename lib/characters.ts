export type StoredCharacter = {
  id: string
  mediaType: "image/jpeg"
  dataBase64: string
}

const DB_NAME = "lanpose"
const STORE = "characters"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function readStoredCharacters(): Promise<StoredCharacter[]> {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly")
      const request = tx.objectStore(STORE).get("current")
      request.onsuccess = () => {
        const value = request.result
        resolve(Array.isArray(value) ? value : [])
      }
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

export async function writeStoredCharacters(images: StoredCharacter[]) {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite")
      tx.objectStore(STORE).put(images, "current")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function fileToCharacter(file: File): Promise<StoredCharacter> {
  const bitmap = await createImageBitmap(file)
  const maxEdge = 1280
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("无法读取这张图片")
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86))
  if (!blob) throw new Error("无法压缩这张图片")
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ""
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return {
    id: crypto.randomUUID(),
    mediaType: "image/jpeg",
    dataBase64: btoa(binary),
  }
}
