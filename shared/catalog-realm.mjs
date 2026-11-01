const LIVE_COSTUME_CATEGORIES = new Set(["春", "夏", "秋", "冬", "パーティ", "ランジェリー", "水着", "セクシー"])
const LIVE_FACE_SECTIONS = new Set(["脸部特写", "造型"])

/** Old anime stand-ins. They are not part of either shipped library. */
export function isRetiredAnimeStandIn(item) {
  const credit = item?.credit || ""
  const id = String(item?.id || "")
  return credit === "publicdomainq.net"
    || credit === "commons.wikimedia.org"
    || id.startsWith("ANM-")
    || id.startsWith("anime_face")
    || id.startsWith("anime-face")
    || item?.section === "anime-closeup"
    || item?.section === "anime-expression"
}

export function isLivePose(pose) {
  if (!pose || isRetiredAnimeStandIn(pose)) return false
  if (pose.systemId === "anime") return false
  if (String(pose.id || "").startsWith("anime_")) return false
  if (String(pose.system || "").includes("二次元")) return false
  return true
}

export function isLivePoseSystem(system) {
  if (!system || system.id === "custom") return false
  if (system.id === "anime") return false
  return !String(system.name || "").includes("二次元")
}

export function isLiveCostume(costume) {
  if (!costume || isRetiredAnimeStandIn(costume)) return false
  return LIVE_COSTUME_CATEGORIES.has(costume.category)
}

export function isLiveCostumeCategory(category) {
  return LIVE_COSTUME_CATEGORIES.has(category?.id)
}

export function isLiveFace(face) {
  if (!face || isRetiredAnimeStandIn(face)) return false
  return LIVE_FACE_SECTIONS.has(face.section)
}

export function isLiveFaceSection(section) {
  return LIVE_FACE_SECTIONS.has(section?.id)
}
