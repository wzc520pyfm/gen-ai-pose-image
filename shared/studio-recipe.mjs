export function buildRecipe({ face, costume, poses, keepOutfit }) {
  const faceChip = face
    ? { id: "face", kind: "face", label: `脸 · ${face.id}`, removable: true }
    : { id: "face", kind: "face", label: "保持原脸", removable: false }
  const costumeChip = costume
    ? { id: "costume", kind: "costume", label: `服 · ${costume.id}`, removable: true }
    : keepOutfit
      ? { id: "costume", kind: "costume", label: "保持服装", removable: false }
      : { id: "costume", kind: "costume", label: "未指定服装", removable: false }
  const poseChips = []
  if (!poses.length) {
    poseChips.push({ id: "poses-empty", kind: "pose", label: "未选姿势", removable: false })
  } else {
    for (const pose of poses.slice(0, 3)) {
      poseChips.push({ id: pose.id, kind: "pose", label: `姿 · ${pose.title}`, removable: true })
    }
    if (poses.length > 3) {
      poseChips.push({ id: "poses-more", kind: "pose", label: `+${poses.length - 3}`, removable: false })
    }
  }
  const score = (face ? 1 : 0) + (costume ? 1 : 0) + (poses.length > 0 ? 1 : 0)
  return { chips: [faceChip, costumeChip, ...poseChips], score, scoreLabel: `配方 ${score}/3` }
}

export function libraryForRecipeChip(chip) {
  if (chip.kind === "face") return "faces"
  if (chip.kind === "costume") return "costumes"
  return "poses"
}

export function poseLimit(mode) {
  return mode === "sheet" ? 4 : 8
}

export function generateBlocked({ poseCount, localMode, hasCostume, mode }) {
  if (poseCount > poseLimit(mode)) return true
  if (poseCount === 0 && !(localMode && hasCostume)) return true
  return false
}

export function busyLabel(elapsed) {
  return `正在生成 · ${elapsed}s`
}

export function recipeAlerts({ workbenchOpen, runError, limitNote }) {
  if (workbenchOpen) return []
  const alerts = []
  if (runError) alerts.push({ id: "run", status: "danger", text: runError })
  if (limitNote) alerts.push({ id: "limit", status: "warning", text: limitNote })
  return alerts
}

export function showViewResult(layout, previewOpen, hasImage) {
  if (layout === "D") return true
  if (layout === "A") return !previewOpen && Boolean(hasImage)
  return false
}

export function showHeaderRandom(layout) {
  return layout === "A"
}

export function showRecipeRandom(layout) {
  return layout === "B" || layout === "D"
}
