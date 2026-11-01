import library from "../data/anime-library.json" with { type: "json" }

export const animePoses = library.poses
export const animeCostumes = library.costumes
export const animeFaces = library.faces

export const ANIME_POSE_NOTE = " 二次元补充姿势不随包分发，按条读取图像所在站点：publicdomainq.net 的公有领域插画，以及 Wikimedia Commons 上的可再使用插画。"
export const ANIME_COSTUME_NOTE = " 二次元补充服装按条读取 publicdomainq.net 的公有领域插画。图里可能有穿着者，生图只取衣服。"
export const ANIME_FACE_NOTE = " 二次元补充脸部按条读取 publicdomainq.net 的公有领域插画，以及 Wikimedia Commons 上的可再使用插画。"

export function hostCredit(item) {
  if (!item?.credit) return {}
  return {
    credit: item.credit,
    sourceUrl: item.sourceUrl || "",
    license: item.license || "",
    ...(item.author ? { author: item.author } : {}),
  }
}

export function poseCreditLine(pose) {
  if (!pose?.credit) return ""
  return pose.author ? `${pose.credit} · ${pose.author}` : pose.credit
}
