export type BuiltinModel = {
  id: string
  name: string
  portrait: string
  sheet: string
  blurb: string
}

export const BUILTIN_MODELS: readonly BuiltinModel[]
export function isBuiltinModelId(id: string): boolean
export function getBuiltinModel(id: string): BuiltinModel | null
