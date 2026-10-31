import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const WORKFLOW = join(dirname(fileURLToPath(import.meta.url)), "workflows", "local-tryon.api.json")

export function comfyURL(env = process.env) {
  if (env.LANPOSE_COMFYUI !== "1") throw new Error("本地生图尚未启用。请在同一电脑启动工作室，并设置 LANPOSE_COMFYUI=1。")
  const url = new URL(env.LANPOSE_COMFYUI_URL || "http://127.0.0.1:8188")
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("ComfyUI 地址必须是本机回环地址，且不能带路径、凭据或查询参数。")
  }
  return url.origin
}

export function assertLocalRequest(url, origin) {
  const local = new URL(url)
  if (!["127.0.0.1", "localhost", "[::1]"].includes(local.hostname) || (origin && origin !== local.origin)) {
    throw new Error("本地生图仅接受本机工作室的同源请求。")
  }
  comfyURL()
}

export function dimensions(aspect = "3:4") {
  const sizes = { "1:1": [768, 768], "3:4": [672, 896], "4:3": [896, 672], "9:16": [576, 1024], "16:9": [1024, 576] }
  return sizes[aspect] || sizes["3:4"]
}

function faceSlot(characterCount, costume) {
  return Math.max(1, Number(characterCount) || 1) + (costume ? 4 : 3)
}

function applyFacePrompt(text, face, index) {
  const label = [face.section, face.hair, face.label].filter(Boolean).join(", ")
  const line = `Use <image${index}> as the only face, expression, bone structure and hairstyle reference${face.id ? ` (${face.id}${label ? `, ${label}` : ""})` : ""}. Keep non-face identity markers from the character references, including whale ears and a whale tail when the character has them. Do not copy clothes, body, or background from <image${index}>.`
  return `${text} ${line}`
}

export function localPrompts({ pose, costume, face = null, extraPrompt = "", characterCount = 1, keepOutfit = true }) {
  const people = pose?.people > 1 ? "exactly two adult people, matching their positions and interaction in the pose reference; the main person matches the identity references, the other person is fully clothed" : "exactly one adult person, a single subject, no duplicate people"
  const action = pose ? `${pose.name}; ${pose.angle}; ${pose.category}` : "keep the original pose and framing"
  const half = pose?.system?.includes("半身")
  const framing = half ? "an upper-body portrait from head to waist, with head and both arms visible" : "a full-body portrait with head and feet visible"
  if (face && !(Number(characterCount) > 0)) {
    const label = [face.section, face.hair, face.label].filter(Boolean).join(", ")
    const identity = `There is no character sheet. The person image is only a face, expression, bone structure and hairstyle reference${face.id ? ` (${face.id}${label ? `, ${label}` : ""})` : ""}. Do not copy clothes, body, or background from it. Do not add whale ears, a whale tail, horns, or any trait that is not in that face reference. The person is an adult.`
    return {
      outfit: `Edit the person image: replace the outfit with the complete outfit in the garment image. Match its colors, fabric, patterns, silhouette and accessories. ${identity} Keep a natural adult body. One image, no collage. ${extraPrompt}`,
      scaffold: `A studio image of ${people}, ${framing}, wearing a loose opaque long-sleeved neutral gray shirt and full-length opaque trousers, fully dressed. Pose and camera: ${action}. Follow the depth map for body positions and composition, natural anatomy, simple neutral background. ${identity} ${extraPrompt}`,
      final: costume
        ? `Create one image of ${people}, ${framing}. Use the pose reference only for pose and framing: ${action}. ${identity} Dress the person in the complete outfit from the clothing reference, accurately matching its colors, fabric, patterns, sleeves, neckline and silhouette. No collage, no text. ${extraPrompt}`
        : `Create one image of ${people}, ${framing}. Use the pose reference only for body pose and framing: ${action}. ${identity} ${keepOutfit ? "Dress them in a complete everyday outfit, fully clothed." : "You may change the clothes according to the following description, keeping every person fully clothed in opaque clothing."} Do not copy clothes from the face reference. No collage, no text. ${extraPrompt}`,
    }
  }
  const identity = characterCount > 1 ? "All additional identity images show the same main person from different views. Preserve that person's identity, face, hair, body type and visual style." : "Preserve the main person's identity, face, hair, body type and visual style."
  const prompts = {
    outfit: `Edit <image1>: replace the main person's outfit with the complete outfit in <image2>. Match its colors, fabric, patterns, silhouette and accessories. Keep the original pose, face, hair, framing and background. ${identity} One image, no collage. ${extraPrompt}`,
    scaffold: `A studio image of ${people}, ${framing}, wearing a loose opaque long-sleeved neutral gray shirt and full-length opaque trousers, fully dressed. Pose and camera: ${action}. Follow the depth map for body positions and composition, natural anatomy, simple neutral background. ${extraPrompt}`,
    final: costume
      ? `Create one image of ${people}, ${framing}. Use <image1> only for pose and framing: ${action}. The main person's face and identity must precisely match the original in <image4>. Use <image2> for the person wearing the outfit. Dress the main person in the complete outfit from <image3>, accurately matching its colors, fabric, patterns, sleeves, neckline and silhouette. ${identity} Do not copy the scaffold's face or clothing. No collage, no text. ${extraPrompt}`
      : half
        ? `Create an upper-body portrait of ${people}, the exact same person in <image1>. Her face, facial features, hair, skin tone and visible clothes must precisely match <image1> and <image3>. Change her pose to match <image2>: ${action}. Keep her original clothing, including its colors, neckline, fabric and sleeves; do not copy the face or clothes from <image2>. Frame from head to waist with both hands visible, fully clothed, natural anatomy. ${identity} No collage, no text. ${extraPrompt}`
        : `Create a full-body portrait of ${people}. Use <image1> only for body pose and framing: ${action}. The face, identity, skin tone and hairstyle must match <image2>, not <image1>. Replace clothing on <image1> with the same outfit worn by the person in <image3>, matching the clothing, colors, fabric, sleeves and neckline. Do not copy clothes from <image1>. If the lower body is not visible in <image3>, add opaque full-length trousers or a long skirt appropriate to the outfit. Fully clothed. ${identity} Entire body and feet visible, natural anatomy. No collage, no text. ${extraPrompt}`,
  }
  if (!costume && !keepOutfit) prompts.final = `Create one image of ${people}, ${framing}. Use ${half ? "<image2>" : "<image1>"} only for the body pose: ${action}. Preserve the face, hair and identity from ${half ? "<image1>" : "<image2>"}. You may change the clothes according to the following description, keeping every person fully clothed in opaque clothing. ${identity} No collage, no text. ${extraPrompt}`
  if (face) {
    const index = faceSlot(characterCount, costume)
    if (costume) {
      prompts.final = prompts.final.replace(
        "The main person's face and identity must precisely match the original in <image4>.",
        "Keep identity markers such as ears, horns, or a tail from the character references.",
      )
    } else if (!keepOutfit) {
      prompts.final = prompts.final.replace(
        `Preserve the face, hair and identity from ${half ? "<image1>" : "<image2>"}.`,
        "Preserve non-face identity markers from the character references.",
      )
    } else if (half) {
      prompts.final = prompts.final.replace(
        "Her face, facial features, hair, skin tone and visible clothes must precisely match <image1> and <image3>.",
        "Skin tone and visible clothes must match the character references.",
      )
    } else {
      prompts.final = prompts.final.replace(
        "The face, identity, skin tone and hairstyle must match <image2>, not <image1>.",
        "Skin tone and non-face identity markers must match the character references, not <image1>.",
      )
    }
    prompts.outfit = `${prompts.outfit} Keep the original face for this clothing edit; the face reference is applied in the final image.`
    prompts.final = applyFacePrompt(prompts.final, face, index)
  }
  return prompts
}

// Resolve literal switches before submission: ComfyUI validates even inactive branches.
export function activeGraph(source, output) {
  const graph = structuredClone(source)
  const resolve = (link, seen = new Set()) => {
    if (!Array.isArray(link)) return link
    const [id] = link
    if (seen.has(String(id))) throw new Error("工作流存在循环连接。")
    const node = graph[id]
    if (!node) throw new Error(`工作流连接的节点不存在：${id}`)
    if (node.class_type !== "ComfySwitchNode") return link
    const { switch: control, on_true, on_false } = node.inputs
    const enabled = Array.isArray(control) && graph[control[0]]?.class_type === "PrimitiveBoolean" ? graph[control[0]].inputs.value : control
    if (typeof enabled !== "boolean") throw new Error("工作流开关必须是布尔值。")
    return resolve(enabled ? on_true : on_false, new Set([...seen, String(id)]))
  }
  const result = {}
  const visiting = new Set()
  function visit(id) {
    if (visiting.has(id)) throw new Error("工作流存在循环连接。")
    if (result[id]) return
    const node = graph[id]
    if (!node) throw new Error(`工作流节点不存在：${id}`)
    visiting.add(id)
    for (const [key, value] of Object.entries(node.inputs)) {
      node.inputs[key] = resolve(value)
      if (Array.isArray(node.inputs[key])) visit(String(node.inputs[key][0]))
    }
    visiting.delete(id)
    result[id] = node
  }
  visit(String(output))
  return result
}

export async function buildLocalGraph({ files, pose, costume, face = null, aspectRatio, seed = 42, extraPrompt = "", keepOutfit = true, prefix = "tryon/lanpose" }) {
  if (!pose && !costume) throw new Error("至少启用换装或姿势。")
  const faceOnly = files.characters.length === 0 && Boolean(files.face)
  const characterFiles = files.characters.length > 0 ? files.characters : (files.face ? [files.face] : [])
  if (!characterFiles[0]) throw new Error("先选择一位模特，或选一张脸部参考。")
  const { graph, mapping: m } = JSON.parse(await readFile(WORKFLOW, "utf8"))
  const set = (slot, value) => { const [id, key] = slot; graph[id].inputs[key] = value }
  set(m.person, characterFiles[0])
  set(m.garment, files.garment || characterFiles[0])
  set(m.pose, files.pose || characterFiles[0])
  for (const slot of m.outfitSwitches) set(slot, Boolean(costume))
  set(m.poseSwitch, Boolean(pose))
  const prompts = localPrompts({ pose, costume, face, extraPrompt, characterCount: faceOnly ? 0 : characterFiles.length, keepOutfit })
  set(m.outfitPrompt, prompts.outfit)
  set(m.posePrompt, prompts.scaffold)
  set(m.finalPrompt, prompts.final)
  if (!costume) {
    const finalInputs = graph[m.finalPrompt[0]].inputs
    delete finalInputs["images.image_4"]
    if (pose?.system?.includes("半身")) {
      finalInputs["images.image_1"] = [m.person[0], 0]
      finalInputs["images.image_2"] = m.poseReference
    }
  }
  for (const slot of m.seeds) set(slot, seed)
  set(m.prefix, prefix)
  const [width, height] = dimensions(aspectRatio)
  for (const slot of m.widths) set(slot, width)
  for (const slot of m.heights) set(slot, height)
  // Qwen edits inherit the first reference's dimensions; uploaded person images are fitted too.
  for (let i = 1; i < characterFiles.length; i++) {
    const id = String(500 + i)
    graph[id] = { class_type: "LoadImage", inputs: { image: characterFiles[i] } }
    graph[m.outfitPrompt[0]].inputs[`images.image_${i + 2}`] = [id, 0]
    graph[m.finalPrompt[0]].inputs[`images.image_${i + (costume ? 4 : 3)}`] = [id, 0]
  }
  if (files.face && !faceOnly) {
    const slot = faceSlot(characterFiles.length, costume)
    graph["510"] = { class_type: "LoadImage", inputs: { image: files.face } }
    graph[m.finalPrompt[0]].inputs[`images.image_${slot}`] = ["510", 0]
  }
  return { graph: activeGraph(graph, m.output), output: String(m.output), prompts }
}

export async function checkComfy({ fetchImpl = fetch, signal } = {}) {
  const root = comfyURL()
  const response = await fetchImpl(`${root}/system_stats`, { redirect: "error", signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(10000)]) })
  if (!response.ok) throw new Error("无法连接 ComfyUI，请先启动本机 ComfyUI。")
  await response.json()
  return { available: true, workflow: "统一换装与姿势工作流" }
}

export async function generateLocal({ characters, garment, poseImage, faceImage, pose, costume, face = null, aspectRatio, extraPrompt, keepOutfit = true, seed = 42, signal, fetchImpl = fetch }) {
  const root = comfyURL()
  const linked = AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(600000)])
  const id = randomUUID()
  const request = async (path, init = {}) => {
    const response = await fetchImpl(root + path, { ...init, signal: linked, redirect: "error" })
    if (!response.ok) {
      const message = await response.text()
      throw new Error(`ComfyUI 请求失败（${response.status}）：${message.slice(0, 1200)}`)
    }
    return response
  }
  const { default: sharp } = await import("sharp")
  const upload = async (image, role, index = 0) => {
    const [width, height] = dimensions(aspectRatio)
    const buffer = role === "person"
      ? await sharp(image.buffer, { limitInputPixels: 40000000 }).resize(width, height, { fit: "contain", background: "#eeeeee" }).png().toBuffer()
      : await sharp(image.buffer, { limitInputPixels: 40000000 }).png().toBuffer()
    const data = new FormData()
    data.set("image", new Blob([buffer], { type: "image/png" }), `lanpose-${id}-${role}-${index}.png`)
    data.set("type", "input")
    const body = await (await request("/upload/image", { method: "POST", body: data })).json()
    if (typeof body.name !== "string" || /[\\/]/.test(body.name) || (body.subfolder && !/^[\w/-]+$/.test(body.subfolder)) || body.subfolder?.split("/").includes("..")) throw new Error("ComfyUI 返回的图片路径无效。")
    return body.subfolder ? `${body.subfolder}/${body.name}` : body.name
  }
  const files = { characters: [] }
  for (const [i, image] of characters.entries()) files.characters.push(await upload(image, "person", i))
  if (garment) files.garment = await upload(garment, "garment")
  if (poseImage) files.pose = await upload(poseImage, "pose")
  if (faceImage) files.face = await upload(faceImage, "face")
  const { graph, output } = await buildLocalGraph({ files, pose, costume, face, aspectRatio, extraPrompt, keepOutfit, seed, prefix: `tryon/lanpose-${id}` })
  const info = await (await request("/object_info")).json()
  for (const node of Object.values(graph)) {
    if (!info[node.class_type]) throw new Error(`缺少 ComfyUI 节点：${node.class_type}`)
    for (const [key, value] of Object.entries(node.inputs)) {
      const spec = info[node.class_type].input?.required?.[key] || info[node.class_type].input?.optional?.[key]
      if (key !== "image" && Array.isArray(spec?.[0]) && !spec[0].includes(value)) throw new Error(`ComfyUI 模型或选项未安装：${node.class_type}.${key} = ${value}`)
    }
  }
  let promptId
  try {
    const submitted = await (await request("/prompt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: graph, client_id: id }) })).json()
    promptId = submitted.prompt_id
    if (typeof promptId !== "string" || !/^[\w-]+$/.test(promptId)) throw new Error("ComfyUI 未返回任务编号。")
    while (true) {
      linked.throwIfAborted()
      const history = await (await request(`/history/${promptId}`)).json()
      const entry = history[promptId]
      if (entry) {
        if (entry.status?.status_str === "error") throw new Error("ComfyUI 执行失败，请查看 ComfyUI 的节点报错。")
        const image = entry.outputs?.[output]?.images?.[0]
        if (!image) throw new Error("工作流已结束，但指定输出节点没有图片。")
        if (image.type !== "output") throw new Error("ComfyUI 输出类型无效。")
        const params = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder || "", type: image.type })
        const response = await request(`/view?${params}`)
        const buffer = Buffer.from(await response.arrayBuffer())
        const png = await sharp(buffer, { limitInputPixels: 40000000 }).png().toBuffer()
        return { buffer: png, mediaType: "image/png", referencesSent: true }
      }
      await new Promise((resolve, reject) => {
        const done = () => { clearTimeout(timer); linked.removeEventListener("abort", abort); resolve() }
        const abort = () => { clearTimeout(timer); linked.removeEventListener("abort", abort); reject(linked.reason) }
        const timer = setTimeout(done, 1000)
        linked.addEventListener("abort", abort, { once: true })
        if (linked.aborted) abort()
      })
    }
  } finally {
    if (linked.aborted && promptId) {
      // Only delete our own pending task. /interrupt would stop somebody else's running task.
      await fetchImpl(root + "/queue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ delete: [promptId] }), signal: AbortSignal.timeout(5000) }).catch(() => {})
    }
  }
}

export async function composeLocalSheet(images, aspectRatio) {
  if (!images.length || images.length > 4) throw new Error("拼图需要 1 到 4 张图片。")
  if (images.length === 1) return images[0]
  const { default: sharp } = await import("sharp")
  const [width, height] = dimensions(aspectRatio).map((n) => n * 2)
  const columns = 2, rows = images.length <= 2 ? 1 : 2, gap = 16
  const cellWidth = Math.floor((width - gap * (columns + 1)) / columns)
  const cellHeight = Math.floor((height - gap * (rows + 1)) / rows)
  const layers = []
  for (const [i, image] of images.entries()) layers.push({ input: await sharp(image.buffer).resize(cellWidth, cellHeight, { fit: "contain", background: "white" }).png().toBuffer(), left: gap + (i % columns) * (cellWidth + gap), top: gap + Math.floor(i / columns) * (cellHeight + gap) })
  return { buffer: await sharp({ create: { width, height, channels: 3, background: "white" } }).composite(layers).png().toBuffer(), mediaType: "image/png", referencesSent: true }
}
