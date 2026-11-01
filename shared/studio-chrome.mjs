export function emptyChrome() {
  return {
    previewOpen: false,
    workbenchOpen: false,
    modelStripOpen: false,
    seenResultKey: null,
  }
}

export function createChromeBook() {
  return { A: emptyChrome(), B: emptyChrome(), C: emptyChrome(), D: emptyChrome() }
}

function patch(book, layout, next) {
  return { ...book, [layout]: next }
}

export function reduceChrome(book, layout, action) {
  const current = book[layout]
  if (!current) return book
  if (action.type === "prime") {
    if (current.seenResultKey != null) return book
    return patch(book, layout, { ...current, seenResultKey: action.resultKey ?? "" })
  }
  if (action.type === "success") {
    const key = action.resultKey
    if (!key || key === current.seenResultKey) return book
    const next = { ...current, seenResultKey: key }
    if (layout === "A" || layout === "D") {
      next.previewOpen = true
      next.workbenchOpen = false
    }
    return patch(book, layout, next)
  }
  if (action.type === "dismiss-preview") {
    if (!current.previewOpen) return book
    return patch(book, layout, { ...current, previewOpen: false })
  }
  if (action.type === "open-preview") {
    const next = { ...current, previewOpen: true }
    if (layout === "D" && !action.wide) next.workbenchOpen = false
    return patch(book, layout, next)
  }
  if (action.type === "open-workbench") {
    const next = { ...current, workbenchOpen: true }
    if (layout === "D" && !action.wide) next.previewOpen = false
    return patch(book, layout, next)
  }
  if (action.type === "close-workbench") {
    if (!current.workbenchOpen) return book
    return patch(book, layout, { ...current, workbenchOpen: false })
  }
  if (action.type === "set-model-strip") {
    const open = Boolean(action.open)
    if (current.modelStripOpen === open) return book
    return patch(book, layout, { ...current, modelStripOpen: open })
  }
  return book
}

export const STUDIO_WIDE_MIN = 1024

export function isStudioWide(width) {
  return Number(width) >= STUDIO_WIDE_MIN
}

export function workbenchPlacement(layout, wide) {
  if (layout === "B" && wide) return "right"
  return "bottom"
}

export function previewDrawerPlacement(wide) {
  return wide ? "right" : "bottom"
}

export function showHeaderSettings(layout) {
  return layout !== "A"
}

export function showHeaderLibraryTabs(layout) {
  return layout === "C"
}

export function showMobileWorkOrder(layout) {
  return layout === "C"
}

export function libraryHeading(library) {
  if (library === "costumes") return "服装库"
  if (library === "faces") return "脸部库"
  return "动作姿势库"
}
