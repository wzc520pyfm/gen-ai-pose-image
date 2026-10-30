import catalog from "../data/catalog.json" with { type: "json" }
import { customPoseRecord, isCustomPoseId } from "./custom.mjs"

const byPose = new Map()
const byView = new Map()
for (const pose of catalog.poses) {
  byPose.set(pose.id, pose)
  for (const view of pose.views) byView.set(view.id, { pose, view })
}

export function getCatalog() {
  return catalog
}

export function getPose(id) {
  return byPose.get(id)
}

export function getView(id) {
  return byView.get(id)
}

/** A view id, or a pose id that falls back to the front angle. */
export function resolveView(id) {
  const direct = byView.get(id)
  if (direct) return direct
  const pose = byPose.get(id)
  if (!pose) return undefined
  const view = pose.views.find((item) => item.angle === "正面") ?? pose.views[0]
  return view ? { pose, view } : undefined
}

export function searchPoses({
  query = "",
  systemId = "",
  category = "",
  includeAdult = false,
  limit = 20,
  custom = [],
} = {}) {
  const parts = String(query).trim().toLowerCase().split(/\s+/).filter(Boolean)
  const cap = Math.max(1, Math.min(50, Number(limit) || 20))
  const matches = []
  const wantCustom = !systemId || systemId === "custom"
  if (wantCustom) {
    for (const asset of custom) {
      if (!asset || !isCustomPoseId(asset.id) || !asset.dataBase64) continue
      if (!includeAdult && asset.adult === true) continue
      if (category && category !== "自定义") continue
      const pose = customPoseRecord(asset)
      if (parts.length > 0) {
        const hay = `${pose.name} ${pose.id} ${asset.label ?? ""} ${asset.userPrompt ?? ""}`.toLowerCase()
        if (!parts.every((part) => hay.includes(part))) continue
      }
      matches.push(pose)
      if (matches.length >= cap) return matches
    }
  }
  if (systemId === "custom") return matches
  for (const pose of catalog.poses) {
    if (!includeAdult && pose.adult) continue
    if (systemId && pose.systemId !== systemId) continue
    if (category && pose.category !== category) continue
    if (parts.length > 0) {
      const hay = `${pose.name} ${pose.code} ${pose.category} ${pose.system} ${pose.id}`.toLowerCase()
      if (!parts.every((part) => hay.includes(part))) continue
    }
    matches.push(pose)
    if (matches.length >= cap) break
  }
  return matches
}
