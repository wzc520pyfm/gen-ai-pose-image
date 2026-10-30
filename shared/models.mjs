import { BUILTIN_MODELS, isBuiltinModelId } from "./builtin-models.mjs"

export { BUILTIN_MODELS, isBuiltinModelId }

export const DEFAULT_MODEL_ID = "dafeiyu"

export function createModelId(random = () => globalThis.crypto.randomUUID()) {
  return `model-${random()}`
}

export function photosOnly(images) {
  return (Array.isArray(images) ? images : []).filter((image) => image && image.dataBase64 && image.role !== "sheet")
}

export function identityImage(images) {
  return photosOnly(images)[0] || (Array.isArray(images) ? images.find((image) => image?.dataBase64) : null) || null
}

export function withGeneratedSheet(images, sheet) {
  if (!sheet?.dataBase64) throw new Error("多视角 sheet 是空的")
  const photos = photosOnly(images).map((image) => ({ ...image, role: "photo" }))
  return [{ ...sheet, role: "sheet" }, ...photos]
}

export function withUploadedSheet(images, sheet) {
  return withGeneratedSheet(images, sheet)
}

export function syncLibrary(models, activeId, images, now = Date.now(), random = () => globalThis.crypto.randomUUID()) {
  const list = Array.isArray(models) ? models.slice() : []
  if (!images?.length) {
    if (!activeId || isBuiltinModelId(activeId)) {
      return { models: list, activeId: isBuiltinModelId(activeId) ? activeId : DEFAULT_MODEL_ID, removedId: null, entry: null }
    }
    return {
      models: list.filter((model) => model.id !== activeId),
      activeId: DEFAULT_MODEL_ID,
      removedId: activeId,
      entry: null,
    }
  }
  const index = list.findIndex((model) => model.id === activeId)
  if (index >= 0) {
    const entry = { ...list[index], images, updatedAt: now, lastUsedAt: now }
    const next = list.slice()
    next[index] = entry
    return { models: next, activeId, removedId: null, entry }
  }
  const entry = {
    id: createModelId(random),
    label: `模特 ${list.length + 1}`,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    images,
  }
  return { models: [entry, ...list], activeId: entry.id, removedId: null, entry }
}

export function adoptCurrent(models, images, activeId, now = Date.now(), random = () => globalThis.crypto.randomUUID()) {
  const list = Array.isArray(models) ? models.slice() : []
  if (isBuiltinModelId(activeId)) return { models: list, activeId, adopted: false, entry: null }
  const known = activeId && list.some((model) => model.id === activeId) ? activeId : null
  if (!images?.length) return { models: list, activeId: known || DEFAULT_MODEL_ID, adopted: false, entry: null }
  if (known) return { models: list, activeId: known, adopted: false, entry: null }
  const entry = {
    id: createModelId(random),
    label: `模特 ${list.length + 1}`,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    images,
  }
  return { models: [entry, ...list], activeId: entry.id, adopted: true, entry }
}

export function activateModel(models, id) {
  const found = (Array.isArray(models) ? models : []).find((model) => model.id === id)
  if (!found) throw new Error("找不到这个模特")
  return found
}

export function renameModel(models, id, label) {
  if (isBuiltinModelId(id)) throw new Error("内置模特不能改名")
  const text = String(label || "").trim().slice(0, 40)
  if (!text) throw new Error("模特名称不能为空")
  const list = Array.isArray(models) ? models.slice() : []
  const index = list.findIndex((model) => model.id === id)
  if (index < 0) throw new Error("找不到这个模特")
  list[index] = { ...list[index], label: text }
  return list
}

export function deleteFromLibrary(models, id, activeId) {
  if (isBuiltinModelId(id)) throw new Error("内置模特不能删除")
  const list = (Array.isArray(models) ? models : []).filter((model) => model.id !== id)
  return {
    models: list,
    activeId: activeId === id ? DEFAULT_MODEL_ID : activeId,
    cleared: activeId === id,
  }
}

export function markModelUsed(models, id, now = Date.now()) {
  if (isBuiltinModelId(id)) return models
  const list = Array.isArray(models) ? models.slice() : []
  const index = list.findIndex((model) => model.id === id)
  if (index < 0) throw new Error("找不到这个模特")
  list[index] = { ...list[index], lastUsedAt: now }
  return list
}

export function cycleModelId(entries, activeId, direction) {
  const list = Array.isArray(entries) ? entries : []
  if (list.length === 0) return activeId || ""
  const index = list.findIndex((item) => item.id === activeId)
  const start = index < 0 ? 0 : index
  const delta = direction === "prev" ? -1 : 1
  return list[(start + delta + list.length) % list.length].id
}

export function switcherEntries({ models = [], builtinUsed = {} } = {}) {
  const builtins = BUILTIN_MODELS.map((model) => ({
    id: model.id,
    label: model.name,
    builtin: true,
    lastUsedAt: Number(builtinUsed[model.id]) || 0,
    portrait: model.portrait,
    sheet: model.sheet,
  }))
  const custom = (Array.isArray(models) ? models : []).map((model) => ({
    id: model.id,
    label: model.label,
    builtin: false,
    lastUsedAt: Number(model.lastUsedAt || model.updatedAt || model.createdAt) || 0,
    portrait: "",
    sheet: "",
  }))
  return [...builtins, ...custom].sort((a, b) => {
    if (b.lastUsedAt !== a.lastUsedAt) return b.lastUsedAt - a.lastUsedAt
    if (a.builtin !== b.builtin) return a.builtin ? -1 : 1
    return a.label.localeCompare(b.label, "zh")
  })
}
