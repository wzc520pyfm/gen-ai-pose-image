export type PoseView = {
  id: string
  angle: string
  angleId: string
  thumb: string
  full: string
}

export type Pose = {
  id: string
  system: string
  systemId: string
  code: string
  category: string
  name: string
  adult: boolean
  people: 1 | 2
  views: PoseView[]
}

export type PoseSystem = {
  id: string
  name: string
  adult: boolean
  poseCount: number
}

export type Catalog = {
  version: 1
  source: string
  upstream: string
  origin: string
  attribution: string
  poseCount: number
  viewCount: number
  adultPoseCount: number
  systems: PoseSystem[]
  poses: Pose[]
}

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9"
export type ProviderId = "gemini" | "openai"
export type GenerateMode = "each" | "sheet"

export type CharacterImageInput = {
  mediaType: string
  dataBase64?: string
}

export type PromptCard = {
  viewId: string
  title: string
  prompt: string
}

export type GeneratedResult = {
  viewId: string
  title: string
  prompt: string
  ok: boolean
  error?: string
  mediaType?: string
  imageBase64?: string
  referencesSent?: boolean
  warning?: string
}

export const ASPECT_RATIOS: AspectRatio[] = ["3:4", "1:1", "4:3", "9:16", "16:9"]

export const ASPECT_LABEL: Record<AspectRatio, string> = {
  "3:4": "竖图 3:4",
  "1:1": "方图 1:1",
  "4:3": "横图 4:3",
  "9:16": "竖屏 9:16",
  "16:9": "宽屏 16:9",
}
