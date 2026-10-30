import { isCustomCostumeId, isCustomPoseId } from "./custom.mjs"

const poses = new Map()
const costumes = new Map()

export function resetCustomLibrary() {
  poses.clear()
  costumes.clear()
}

export function normalizeCustomAsset(input, kind) {
  const id = typeof input?.id === "string" ? input.id.trim() : ""
  if (kind === "pose" && !isCustomPoseId(id)) throw new Error("自定义姿势 id 无效")
  if (kind === "costume" && !isCustomCostumeId(id)) throw new Error("自定义服装 id 无效")
  const dataBase64 = typeof input?.dataBase64 === "string" ? input.dataBase64.replace(/\s/g, "") : ""
  if (dataBase64 && !/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64)) throw new Error("参考图数据无效")
  if (dataBase64.length > 12_000_000) throw new Error("参考图过大")
  const label = String(input?.label || input?.name || "").trim().slice(0, 80) || (kind === "pose" ? "自定义姿势" : "自定义服装")
  return {
    id,
    label,
    keywords: String(input?.keywords || label).trim().slice(0, 300),
    adult: input?.adult === true,
    source: input?.source === "generated" ? "generated" : "upload",
    userPrompt: String(input?.userPrompt || "").slice(0, 2000),
    beautifiedPrompt: String(input?.beautifiedPrompt || "").slice(0, 4000),
    mediaType: input?.mediaType === "image/png" || input?.mediaType === "image/webp" ? input.mediaType : "image/jpeg",
    dataBase64,
    createdAt: Number(input?.createdAt) || Date.now(),
  }
}

export function replaceCustomLibrary({ poses: nextPoses = [], costumes: nextCostumes = [] } = {}) {
  const poseNext = new Map()
  const costumeNext = new Map()
  for (const item of nextPoses) {
    const normalized = normalizeCustomAsset(item, "pose")
    poseNext.set(normalized.id, normalized)
  }
  for (const item of nextCostumes) {
    const normalized = normalizeCustomAsset(item, "costume")
    costumeNext.set(normalized.id, normalized)
  }
  poses.clear()
  costumes.clear()
  for (const [id, value] of poseNext) poses.set(id, value)
  for (const [id, value] of costumeNext) costumes.set(id, value)
}

export function upsertCustomPose(input) {
  const normalized = normalizeCustomAsset(input, "pose")
  poses.set(normalized.id, normalized)
  return normalized
}

export function upsertCustomCostume(input) {
  const normalized = normalizeCustomAsset(input, "costume")
  costumes.set(normalized.id, normalized)
  return normalized
}

export function removeCustomAsset(id) {
  const removed = poses.delete(id) || costumes.delete(id)
  return removed
}

export function listCustomPoseAssets() {
  return [...poses.values()]
}

export function listCustomCostumeAssets() {
  return [...costumes.values()]
}

export function getCustomPoseAsset(id) {
  return poses.get(id)
}

export function getCustomCostumeAsset(id) {
  return costumes.get(id)
}
