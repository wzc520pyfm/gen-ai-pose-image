import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { getCatalog, resolveView } from "../shared/catalog.mjs"
import { costumeFile, fetchCostumeBytes, getCostume, getCostumeCatalog } from "../shared/costumes.mjs"
import { fetchPoseBytes, planRequest, poseFileFor, promptCards, runGeneration } from "../shared/jobs.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const MAX_BODY = 12 * 1024 * 1024

function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  })
  res.end(body)
}

function sameOrigin(req) {
  const origin = req.headers.origin
  const host = req.headers.host
  return origin === undefined || host === undefined || origin === `http://${host}` || origin === `https://${host}`
}

async function readBody(req) {
  const chunks = []
  let bytes = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.byteLength
    if (bytes > MAX_BODY) throw new Error("请求过大")
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

export function createPoseHandler(getConfig) {
  return async function handle(req, res) {
    try {
      if (!sameOrigin(req)) return json(res, 403, { error: "origin-rejected" })
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
      let path = url.pathname
      if (path.startsWith("/dsh-pose-muse")) path = path.slice("/dsh-pose-muse".length) || "/"
      if (req.method === "GET" && path === "/api/catalog") return json(res, 200, getCatalog())
      if (req.method === "GET" && path === "/api/costumes") return json(res, 200, getCostumeCatalog())
      if (req.method === "GET" && path === "/api/costume-image") {
        const costume = getCostume(url.searchParams.get("id") ?? "")
        if (!costume) return json(res, 404, { error: "找不到服装" })
        const requested = url.searchParams.get("size")
        const size = requested === "full" ? "full" : requested === "preview" ? "preview" : "thumb"
        const image = await fetchCostumeBytes(costumeFile(costume, size))
        res.writeHead(200, { "content-type": image.mediaType, "cache-control": "public, max-age=86400" })
        res.end(image.buffer)
        return
      }
      if (req.method === "GET" && path === "/api/status") {
        const config = getConfig()
        return json(res, 200, { keyConfigured: Boolean(process.env.POSE_MUSE_API_KEY || config.apiKey) })
      }
      if (req.method === "GET" && path === "/api/pose-image") {
        const found = resolveView(url.searchParams.get("id") ?? "")
        if (!found) return json(res, 404, { error: "找不到姿势" })
        const size = url.searchParams.get("size") === "full" ? "full" : "thumb"
        const image = await fetchPoseBytes(poseFileFor(found.view, size))
        res.writeHead(200, { "content-type": image.mediaType, "cache-control": "public, max-age=86400" })
        res.end(image.buffer)
        return
      }
      if (req.method === "GET" && (path === "/muse/dafeiyu-sheet.png" || path === "/muse/dafeiyu-portrait.jpg")) {
        const file = join(ROOT, "public", path.slice(1))
        const data = await readFile(file)
        const mediaType = path.endsWith(".png") ? "image/png" : "image/jpeg"
        res.writeHead(200, { "content-type": mediaType, "cache-control": "public, max-age=86400" })
        res.end(data)
        return
      }
      if (req.method === "POST" && (path === "/api/prompt" || path === "/api/generate")) {
        const body = await readBody(req)
        const config = getConfig()
        if (typeof body.apiKey !== "string" || body.apiKey.trim() === "") {
          body.apiKey = process.env.POSE_MUSE_API_KEY || config.apiKey || ""
        }
        if (!body.provider) body.provider = config.provider || "gemini"
        if (!body.model) body.model = config.model || ""
        if (!body.baseURL) body.baseURL = config.baseURL || ""
        if (path === "/api/prompt") return json(res, 200, { prompts: promptCards(planRequest(body)) })
        const { results } = await runGeneration(body, { signal: req.signal })
        return json(res, 200, { results })
      }
      return json(res, 404, { error: "not-found" })
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败"
      if (!res.headersSent) json(res, 400, { error: message })
    }
  }
}
