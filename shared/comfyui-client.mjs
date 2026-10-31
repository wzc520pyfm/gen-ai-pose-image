import { buildLocalGraph } from "./comfyui.mjs"

export const DEFAULT_COMFYUI_URL = "http://127.0.0.1:8188"

export function connectionURL(value = DEFAULT_COMFYUI_URL) {
  let url
  try { url = new URL(value.trim()) } catch { throw new Error("请输入完整的 ComfyUI 地址。") }
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  if ((url.protocol !== "https:" && !(loopback && url.protocol === "http:")) || url.username || url.password || url.search || url.hash) {
    throw new Error("请使用 HTTPS 地址或本机 HTTP 回环地址，不能包含账号密码、查询参数或片段。")
  }
  return url.href.replace(/\/+$/, "")
}

export function createComfyClient({ url, token = "", signal, fetchImpl = fetch }) {
  const root = connectionURL(url)
  if (/[\r\n]/.test(token)) throw new Error("访问令牌格式无效。")
  const accessToken = token.trim()
  const request = async (path, init = {}) => {
    // Only fixed API routes are accepted; credentials must never follow a redirect.
    if (!/^\/(system_stats|object_info|upload\/image|prompt|history\/[\w-]+|view(?:\?.*)?|queue)$/.test(path)) throw new Error("不支持的 ComfyUI 接口。")
    const headers = new Headers(init.headers)
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`)
    let response
    try {
      response = await fetchImpl(root + path, { ...init, headers, signal: init.signal || signal, redirect: "error", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" })
    } catch (error) {
      if (signal?.aborted || init.signal?.aborted) throw error
      throw new Error("无法连接 ComfyUI。请检查地址、服务是否运行、HTTPS、CORS 和浏览器本地网络权限。")
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error(`ComfyUI 拒绝访问（${response.status}），请检查访问令牌和入口权限。`)
      const text = await response.text()
      const message = (accessToken ? text.replaceAll(accessToken, "[已隐藏]") : text).slice(0, 1200)
      throw new Error(`ComfyUI 请求失败（${response.status}）：${message}`)
    }
    return response
  }
  return { request }
}

export async function checkComfyConnection(options) {
  const signal = AbortSignal.any([options.signal || new AbortController().signal, AbortSignal.timeout(10000)])
  const client = createComfyClient({ ...options, signal })
  const stats = await (await client.request("/system_stats")).json()
  if (!stats?.system || !Array.isArray(stats.devices)) throw new Error("该地址没有返回有效的 ComfyUI 服务信息。")
  return { available: true, workflow: "统一换装与姿势工作流" }
}

function pause(signal) {
  return new Promise((resolve, reject) => {
    const done = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); resolve() }
    const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(signal.reason) }
    const timer = setTimeout(done, 1000)
    signal.addEventListener("abort", abort, { once: true })
    if (signal.aborted) abort()
  })
}

export async function generateComfyTask({ url, token, characters, garment, poseImage, faceImage, face = null, pose, costume, aspectRatio, extraPrompt, keepOutfit = true, seed = 42, signal, fetchImpl = fetch }) {
  if (!characters?.length || characters.length > 4) throw new Error("模特参考图需要 1 到 4 张。")
  const linked = AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(600000)])
  const client = createComfyClient({ url, token, signal: linked, fetchImpl })
  const id = crypto.randomUUID()
  const upload = async (image, role, index = 0) => {
    const data = new FormData()
    data.set("image", image, `lanpose-${id}-${role}-${index}.png`)
    data.set("type", "input")
    const body = await (await client.request("/upload/image", { method: "POST", body: data })).json()
    if (typeof body.name !== "string" || !body.name || /[\\/]/.test(body.name) || body.name === ".." || (body.subfolder && !/^[\w/-]+$/.test(body.subfolder)) || body.subfolder?.split("/").includes("..")) throw new Error("ComfyUI 返回的图片路径无效。")
    return body.subfolder ? `${body.subfolder}/${body.name}` : body.name
  }
  // Check dependencies before uploading private images or adding a GPU job.
  const graphInput = { files: { characters: characters.map(() => "person.png"), garment: garment ? "garment.png" : undefined, pose: poseImage ? "pose.png" : undefined, face: faceImage ? "face.png" : undefined }, pose, costume, face, aspectRatio, extraPrompt, keepOutfit, seed, prefix: `tryon/lanpose-${id}` }
  const planned = await buildLocalGraph(graphInput)
  const info = await (await client.request("/object_info")).json()
  for (const node of Object.values(planned.graph)) {
    if (!info[node.class_type]) throw new Error(`缺少 ComfyUI 节点：${node.class_type}`)
    for (const [key, value] of Object.entries(node.inputs)) {
      const spec = info[node.class_type].input?.required?.[key] || info[node.class_type].input?.optional?.[key]
      if (key !== "image" && Array.isArray(spec?.[0]) && !spec[0].includes(value)) throw new Error(`ComfyUI 模型或选项未安装：${node.class_type}.${key} = ${value}`)
    }
  }
  const files = { characters: [] }
  for (const [i, image] of characters.entries()) files.characters.push(await upload(image, "person", i))
  if (garment) files.garment = await upload(garment, "garment")
  if (poseImage) files.pose = await upload(poseImage, "pose")
  if (faceImage) files.face = await upload(faceImage, "face")
  const { graph, output } = await buildLocalGraph({ ...graphInput, files })
  let promptId
  try {
    const submitted = await (await client.request("/prompt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: graph, client_id: id }) })).json()
    promptId = submitted.prompt_id
    if (typeof promptId !== "string" || !/^[\w-]+$/.test(promptId)) { promptId = undefined; throw new Error("ComfyUI 未返回有效的任务编号。") }
    while (true) {
      linked.throwIfAborted()
      const history = await (await client.request(`/history/${promptId}`)).json()
      const entry = history[promptId]
      if (entry) {
        if (entry.status?.status_str === "error") throw new Error("ComfyUI 执行失败，请查看 ComfyUI 的节点报错。")
        const image = entry.outputs?.[output]?.images?.[0]
        if (!image || image.type !== "output" || typeof image.filename !== "string") throw new Error("工作流已结束，但指定输出节点没有有效图片。")
        const params = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder || "", type: "output" })
        return (await client.request(`/view?${params}`)).blob()
      }
      await pause(linked)
    }
  } finally {
    if (linked.aborted && promptId) {
      await client.request("/queue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ delete: [promptId] }), signal: AbortSignal.timeout(5000) }).catch(() => {})
    }
  }
}

export function createSheetCache({ now = Date.now } = {}) {
  const entries = new Map()
  return {
    cells(key) {
      for (const [id, entry] of entries) if (now() - entry.created >= 600000) entries.delete(id)
      if (!entries.has(key)) {
        if (entries.size >= 4) entries.delete(entries.keys().next().value)
        entries.set(key, { created: now(), cells: new Map() })
      }
      return entries.get(key).cells
    },
    delete(key) { entries.delete(key) },
  }
}
