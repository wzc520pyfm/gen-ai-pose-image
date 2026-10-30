import type { StudioSettings } from "@/lib/settings"
import { studioUrl } from "@/lib/studio-env"
import type { StoredCharacter } from "@/lib/characters"

export async function requestCharacterSheet(basePath: string, settings: StudioSettings, image: StoredCharacter) {
  const response = await fetch(studioUrl(basePath, "/api/character-sheet"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      provider: settings.provider,
      apiKey: settings.apiKey,
      baseURL: settings.baseURL,
      model: settings.model,
      image: { mediaType: image.mediaType, dataBase64: image.dataBase64 },
    }),
  })
  const payload = await response.json() as { error?: string; mediaType?: string; imageBase64?: string }
  if (!response.ok || !payload.imageBase64) throw new Error(payload.error || "多视角 sheet 没有生成")
  return { mediaType: payload.mediaType || "image/png", imageBase64: payload.imageBase64 }
}
