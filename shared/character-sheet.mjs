import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { generateImage } from "./generate.mjs"
import { decodeCharacterImage } from "./jobs.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
export const LAYOUT_SHEET_FILE = join(ROOT, "public/muse/dafeiyu-sheet.png")

export const CHARACTER_SHEET_PROMPT = [
  "画一张成年人物的多视角设定图。第一张参考图是要画的人，第二张参考图只提供分格排版。",
  "脸、发型、发色、体型、服装和配饰都只来自第一张图，并且必须是同一个人。",
  "第二张图的格子怎么排，就怎么排：正面、侧面、背面等视角放在同一张图里。不要照抄第二张图里的脸和衣服。",
  "不要画成大肥鱼。不要加鲸耳、鲸尾或女仆装，除非第一张图里本来就有。",
  "这是成年人物。禁止画成儿童、幼儿或青少年，脸和身体都用成人比例。如果年龄含糊，画成二十岁以上。",
  "干净白底，不要文字，不要水印。",
].join("\n")

export async function loadLayoutSheet(deps = {}) {
  const read = deps.readFile ?? readFile
  const file = deps.layoutFile ?? LAYOUT_SHEET_FILE
  try {
    const buffer = await read(file)
    if (!buffer || buffer.byteLength < 32) throw new Error("排版参考是空的")
    return { mediaType: "image/png", buffer, role: "layout" }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("多视角排版参考没有读到")) throw error
    throw new Error("多视角排版参考没有读到。不会改成纯文字生图。")
  }
}

export async function generateCharacterSheet(input = {}) {
  if (!input.image?.dataBase64) throw new Error("先导入一张模特照片")
  const identity = decodeCharacterImage(input.image)
  identity.role = "identity"
  const layout = await loadLayoutSheet(input)
  const images = [identity, layout]
  if (images.length < 2 || images.some((image) => !image?.buffer || image.buffer.byteLength < 32)) {
    throw new Error("多视角参考没有凑齐，不会改成纯文字生图。")
  }
  const generate = input.generate ?? generateImage
  return generate({
    provider: input.provider,
    apiKey: input.apiKey,
    baseURL: input.baseURL ?? "",
    model: input.model,
    prompt: CHARACTER_SHEET_PROMPT,
    images,
    aspectRatio: "16:9",
    signal: input.signal,
  })
}
