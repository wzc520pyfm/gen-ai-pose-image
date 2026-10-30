function usable(random) {
  const value = Number(typeof random === "function" ? random() : Math.random())
  if (!Number.isFinite(value)) return 0
  return Math.min(0.999999, Math.max(0, value))
}

function pickOne(list, random) {
  return list[Math.floor(usable(random) * list.length)]
}

function visible(items, showAdult) {
  return (Array.isArray(items) ? items : []).filter((item) => item && (showAdult || item.adult !== true))
}

/** One visible pose, one of that pose's own views, and one visible costume. Adult items stay out unless showAdult is on. */
export function pickRandomCombo({ poses = [], costumes = [], showAdult = false, random = Math.random } = {}) {
  const posePool = visible(poses, showAdult).filter((pose) => Array.isArray(pose.views) && pose.views.some((item) => item?.id))
  const costumePool = visible(costumes, showAdult).filter((costume) => costume.id)
  if (posePool.length === 0) return { ok: false, message: "没有可选的姿势。", pose: null, view: null, costume: null }
  if (costumePool.length === 0) return { ok: false, message: "没有可选的服装。", pose: null, view: null, costume: null }
  const pose = pickOne(posePool, random)
  const views = pose.views.filter((item) => item?.id)
  return { ok: true, message: "", pose, view: pickOne(views, random), costume: pickOne(costumePool, random) }
}
