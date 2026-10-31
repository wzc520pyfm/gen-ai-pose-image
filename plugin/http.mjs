import { assertLocalRequest, checkComfy } from "../shared/comfyui.mjs"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { beautifyPrompt } from "../shared/beautify.mjs"
import { getCatalog, resolveView } from "../shared/catalog.mjs"
import { costumeFile, fetchCostumeBytes, getCostume, getCostumeCatalog } from "../shared/costumes.mjs"
import { assertBaseURL, defaultModel } from "../shared/generate.mjs"
import { generateCharacterSheet } from "../shared/character-sheet.mjs"
import { statusForStudioError } from "../shared/http-status.mjs"
import { generateStyledReference } from "../shared/style-refs.mjs"
import { planRequest, promptCards, runGeneration } from "../shared/jobs.mjs"
import { fetchPoseBytes, poseFileFor } from "../shared/poses.mjs"
import { replaceCustomLibrary, upsertCustomCostume, upsertCustomPose } from "../shared/registry.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const MAX_BODY = 32 * 1024 * 1024
const ASPECTS = new Set(["1:1", "3:4", "4:3", "9:16", "16:9"])

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
      if (req.method === "GET" && path === "/api/comfyui") {
        assertLocalRequest(url.href, req.headers.origin)
        return json(res, 200, await checkComfy())
      }
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
        const fromEnv = process.env.POSE_MUSE_PROVIDER
        const named = fromEnv || config.provider || ""
        const provider = named === "seedream" || named === "openai" || named === "gemini" ? named : ""
        return json(res, 200, {
          keyConfigured: Boolean(process.env.POSE_MUSE_API_KEY || config.apiKey),
          provider,
          model: process.env.POSE_MUSE_MODEL?.trim() || config.model || "",
          baseURL: process.env.POSE_MUSE_BASE_URL?.trim() || config.baseURL || "",
        })
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
      if (req.method === "GET" && path.startsWith("/muse/")) {
        const name = path.slice("/muse/".length)
        if (!/^[\w.-]+$/.test(name)) return json(res, 404, { error: "找不到文件" })
        try {
          const data = await readFile(join(ROOT, "public", "muse", name))
          const mediaType = name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : "image/jpeg"
          res.writeHead(200, { "content-type": mediaType, "cache-control": "public, max-age=86400" })
          res.end(data)
        } catch {
          return json(res, 404, { error: "找不到文件" })
        }
        return
      }
      if (req.method === "PUT" && path === "/api/custom-library") {
        const body = await readBody(req)
        replaceCustomLibrary({ poses: body.poses ?? [], costumes: body.costumes ?? [] })
        return json(res, 200, { ok: true })
      }
      if (req.method === "POST" && path === "/api/custom-library") {
        const body = await readBody(req)
        if (body.kind === "costume") upsertCustomCostume(body.item)
        else upsertCustomPose(body.item)
        return json(res, 200, { ok: true })
      }
      if (req.method === "POST" && (path === "/api/prompt" || path === "/api/generate" || path === "/api/beautify" || path === "/api/reference" || path === "/api/character-sheet")) {
        const body = await readBody(req)
        const config = getConfig()
        if (body.engine === "comfyui") assertLocalRequest(url.href, req.headers.origin)
        if (typeof body.apiKey !== "string" || body.apiKey.trim() === "") {
          body.apiKey = process.env.POSE_MUSE_API_KEY || config.apiKey || ""
        }
        if (!body.provider) body.provider = config.provider || "gemini"
        if (!body.model) body.model = config.model || ""
        if (!body.baseURL) body.baseURL = config.baseURL || ""
        if (path === "/api/prompt") return json(res, 200, { prompts: promptCards(planRequest(body)) })
        if (path === "/api/beautify") {
          const kind = body.kind === "costume" ? "costume" : body.kind === "pose" ? "pose" : ""
          if (!kind) return json(res, 400, { error: "需要说明是姿势还是服装" })
          const result = await beautifyPrompt({
            provider: body.provider,
            apiKey: body.apiKey,
            baseURL: body.baseURL,
            textModel: typeof body.textModel === "string" ? body.textModel : "",
            kind,
            userPrompt: typeof body.userPrompt === "string" ? body.userPrompt : "",
            adult: body.adult === true,
            sensitivePromptOptimize: body.sensitivePromptOptimize === true,
            signal: req.signal,
          })
          return json(res, 200, result)
        }
        if (path === "/api/reference") {
          const kind = body.kind === "pose" || body.kind === "costume" ? body.kind : ""
          if (!kind) return json(res, 400, { error: "需要说明是姿势还是服装" })
          const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
          if (!prompt) return json(res, 400, { error: "先写好提示词" })
          if (!String(body.apiKey || "").trim()) return json(res, 400, { error: "还没有填写 API Key" })
          const provider = body.provider === "openai" || body.provider === "seedream" || body.provider === "gemini" ? body.provider : null
          if (!provider) return json(res, 400, { error: "不支持的生图接口" })
          const image = await generateStyledReference({
            kind,
            provider,
            apiKey: String(body.apiKey).trim(),
            baseURL: assertBaseURL(body.baseURL),
            model: String(body.model || "").trim() || defaultModel(provider),
            prompt,
            aspectRatio: ASPECTS.has(body.aspectRatio) ? body.aspectRatio : "3:4",
            sensitivePromptOptimize: body.sensitivePromptOptimize === true,
            signal: req.signal,
          })
          return json(res, 200, { mediaType: image.mediaType, imageBase64: image.buffer.toString("base64") })
        }
        if (path === "/api/character-sheet") {
          const source = body.image
          if (!source || typeof source !== "object" || typeof source.dataBase64 !== "string" || source.dataBase64.trim() === "") {
            return json(res, 400, { error: "先导入一张模特照片" })
          }
          if (!String(body.apiKey || "").trim()) return json(res, 400, { error: "还没有填写 API Key" })
          const provider = body.provider === "openai" || body.provider === "seedream" || body.provider === "gemini" ? body.provider : null
          if (!provider) return json(res, 400, { error: "不支持的生图接口" })
          const sheet = await generateCharacterSheet({
            provider,
            apiKey: String(body.apiKey).trim(),
            baseURL: assertBaseURL(body.baseURL),
            model: String(body.model || "").trim() || defaultModel(provider),
            image: {
              mediaType: typeof source.mediaType === "string" ? source.mediaType : "image/jpeg",
              dataBase64: source.dataBase64,
            },
            signal: req.signal,
          })
          return json(res, 200, { mediaType: sheet.mediaType, imageBase64: sheet.buffer.toString("base64") })
        }
        const { results } = await runGeneration(body, { signal: req.signal })
        return json(res, 200, { results })
      }
      return json(res, 404, { error: "not-found" })
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败"
      if (!res.headersSent) json(res, statusForStudioError(error), { error: message })
    }
  }
}
