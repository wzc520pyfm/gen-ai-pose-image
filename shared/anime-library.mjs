import library from "../data/anime-library.json" with { type: "json" }

export const animePoseCatalog = library.poseCatalog
export const animeCostumeCatalog = library.costumeCatalog
export const animeFaceCatalog = library.faceCatalog

export const ANIME_COSTUME_CATEGORIES = new Set(animeCostumeCatalog.categories.map((item) => item.id))
export const ANIME_FACE_SECTIONS = new Set(animeFaceCatalog.sections.map((item) => item.id))
