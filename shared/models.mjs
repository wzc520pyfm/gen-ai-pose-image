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

export function syncLibrary(models, activeId, images, now = Date.now(), random = () => globalThis.crypto.randomUUID()) {
  const list = Array.isArray(models) ? models.slice() : []
  if (!images?.length) {
    if (!activeId) return { models: list, activeId: null, removedId: null, entry: null }
    return {
      models: list.filter((model) => model.id !== activeId),
      activeId: null,
      removedId: activeId,
      entry: null,
    }
  }
  const index = list.findIndex((model) => model.id === activeId)
  if (index >= 0) {
    const entry = { ...list[index], images, updatedAt: now }
    const next = list.slice()
    next[index] = entry
    return { models: next, activeId, removedId: null, entry }
  }
  const entry = {
    id: createModelId(random),
    label: `模特 ${list.length + 1}`,
    createdAt: now,
    updatedAt: now,
    images,
  }
  return { models: [entry, ...list], activeId: entry.id, removedId: null, entry }
}

export function adoptCurrent(models, images, activeId, now = Date.now(), random = () => globalThis.crypto.randomUUID()) {
  const list = Array.isArray(models) ? models.slice() : []
  const known = activeId && list.some((model) => model.id === activeId) ? activeId : null
  if (!images?.length) return { models: list, activeId: known, adopted: false, entry: null }
  if (known) return { models: list, activeId: known, adopted: false, entry: null }
  const entry = {
    id: createModelId(random),
    label: `模特 ${list.length + 1}`,
    createdAt: now,
    updatedAt: now,
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
  const text = String(label || "").trim().slice(0, 40)
  if (!text) throw new Error("模特名称不能为空")
  const list = Array.isArray(models) ? models.slice() : []
  const index = list.findIndex((model) => model.id === id)
  if (index < 0) throw new Error("找不到这个模特")
  list[index] = { ...list[index], label: text }
  return list
}

export function deleteFromLibrary(models, id, activeId) {
  const list = (Array.isArray(models) ? models : []).filter((model) => model.id !== id)
  return {
    models: list,
    activeId: activeId === id ? null : activeId,
    cleared: activeId === id,
  }
}
