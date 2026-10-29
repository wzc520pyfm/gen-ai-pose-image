import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createRequire } from "node:module"
import { searchPoses } from "../shared/catalog.mjs"
import { planRequest, promptCards, runGeneration } from "../shared/jobs.mjs"
import { createPoseHandler } from "./http.mjs"

const require = createRequire(import.meta.url)

export const name = "dsh-pose-muse"
export const inject = ["tools"]

const DEFAULTS = {
  provider: "gemini",
  model: "",
  baseURL: "",
  apiKey: "",
  aspectRatio: "3:4",
  poseOrigin: "https://ai-pose-gallery.anhao.app",
}

function defineToolFallback(tool) {
  return tool
}

function loadDefineTool() {
  try {
    const loaded = require("@deepseek-ai/dsh-tools")
    if (typeof loaded.defineTool === "function") return loaded.defineTool
  } catch {
    // The host injects this package. Outside Harness the plain object still describes the tool.
  }
  return defineToolFallback
}

function apiKey(config) {
  return process.env.POSE_MUSE_API_KEY || config.apiKey || ""
}

function imageSize(buffer) {
  if (buffer.length > 24 && buffer[0] === 0x89 && buffer[1] === 0x50) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  let offset = 2
  while (offset + 8 < buffer.length && buffer[offset] === 0xff) {
    const marker = buffer[offset + 1]
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2
      continue
    }
    const length = buffer.readUInt16BE(offset + 2)
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) }
    }
    offset += 2 + length
  }
  return { width: 1024, height: 1024 }
}

async function persistImage(ctx, buffer, mediaType, title) {
  const size = imageSize(buffer)
  if (ctx.attachments && typeof ctx.attachments.saveImage === "function") {
    try {
      const attachment = await ctx.attachments.saveImage({
        data: buffer,
        mediaType,
        name: title.slice(0, 80),
      })
      return { attachment, width: size.width, height: size.height, bytes: buffer.byteLength, mediaType }
    } catch (error) {
      const message = error instanceof Error ? error.message : "附件保存失败"
      return { saveError: message, width: size.width, height: size.height, bytes: buffer.byteLength, mediaType }
    }
  }
  const folder = join(process.cwd(), "pose-muse-output")
  await mkdir(folder, { recursive: true })
  const ext = mediaType === "image/jpeg" ? "jpg" : mediaType === "image/webp" ? "webp" : "png"
  const file = join(folder, `${Date.now()}-${title.replace(/[^\w\u4e00-\u9fff-]+/g, "_").slice(0, 40)}.${ext}`)
  await writeFile(file, buffer)
  return { savedTo: file, width: size.width, height: size.height, bytes: buffer.byteLength, mediaType }
}

export function apply(ctx, config = {}) {
  const current = () => ({ ...DEFAULTS, ...config })
  if (typeof ctx.inject === "function") {
    ctx.inject(["webServer"], (webCtx) => {
      const handle = createPoseHandler(current)
      webCtx.effect(() => webCtx.webServer.register({
        kind: "prefix",
        path: "/dsh-pose-muse",
        handler: handle,
      }), "dsh-pose-muse routes")
    })
    ctx.inject(["systemPrompt"], (promptCtx) => {
      promptCtx.effect(() => promptCtx.systemPrompt.context({
        name: "dsh-pose-muse",
        order: 58,
        text: () => [
          "澜姿插件已安装。用户要按姿势参考出图时，先用 search_poses 查找姿势，再用 generate_pose_images，view_ids 传姿势 id 或具体视角 id。",
          "默认可一次选择多个姿势。默认模特是成年女性「大飞鱼」（社区 DeepSeek 鲸鱼娘的成年形象，蓝发、鲸耳、鲸尾、蓝白女仆装）。不要把角色画成未成年人或 Q 版。",
          "没有 POSE_MUSE_API_KEY 时，generate_pose_images 会返回提示词；若 dsh-image-gen 可用，把提示词原样交给 edit_image 或 generate_image，并附上角色参考与姿势线稿。",
        ].join("\n"),
      }), "dsh-pose-muse prompt")
    })
  }

  const defineTool = loadDefineTool()
  ctx.tools.register(defineTool({
    name: "search_poses",
    description: "Search the Chinese AI pose gallery (ai-pose-gallery-zh): 288 pose groups and 1439 angle views. Use before generate_pose_images. Adult categories stay hidden unless include_adult is true.",
    parameters: {
      query: { type: "string", description: "Pose name, code such as P001, category, or id." },
      system_id: { type: "string", enum: ["full", "sexy", "bust", "pair"], description: "full=标准全身, sexy=性感全身, bust=上半身, pair=双人. Omit to search all visible poses." },
      category: { type: "string", description: "Exact category name, for example 站姿 or 坐姿." },
      include_adult: { type: "boolean", description: "Include sexy and couple poses. Default false." },
      limit: { type: "integer", description: "Max results, 1-30. Default 12." },
    },
    output: {
      schema: { type: "object" },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }],
    },
    async execute(args) {
      const poses = searchPoses({
        query: args.query ?? "",
        systemId: args.system_id ?? "",
        category: args.category ?? "",
        includeAdult: args.include_adult === true,
        limit: args.limit ?? 12,
      })
      return {
        count: poses.length,
        poses: poses.map((pose) => ({
          id: pose.id,
          name: pose.name,
          code: pose.code,
          system: pose.system,
          category: pose.category,
          adult: pose.adult,
          people: pose.people,
          views: pose.views.map((view) => ({ id: view.id, angle: view.angle })),
        })),
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: "generate_pose_images",
    description: "Generate images of the default adult whale-girl 大飞鱼, or describe a wardrobe change, using one or more pose references from search_poses. Pass view ids (or pose ids, which use the front view). Keeps the character's maid outfit unless keep_outfit is false. One image per pose unless mode is sheet.",
    parameters: {
      view_ids: { type: "array", items: { type: "string" }, required: true, description: "Pose or view ids from search_poses. Up to 8 for each, 4 for sheet." },
      extra_prompt: { type: "string", description: "Optional scene, lighting, or wardrobe note." },
      keep_outfit: { type: "boolean", description: "Keep 大飞鱼's blue-and-white maid outfit, whale ears and tail. Default true." },
      aspect_ratio: { type: "string", enum: ["1:1", "3:4", "4:3", "9:16", "16:9"], description: "Default 3:4." },
      mode: { type: "string", enum: ["each", "sheet"], description: "each makes one image per pose. sheet puts up to 4 poses in one image." },
      provider: { type: "string", enum: ["seedream", "gemini", "openai"], description: "Omit to use the plugin default. seedream calls Volcengine Ark." },
      model: { type: "string", description: "Optional model override." },
    },
    output: {
      schema: { type: "object" },
      render: (_args, value) => {
        const images = Array.isArray(value.images) ? value.images : []
        const blocks = [{ type: "text", text: value.message || `生成了 ${images.filter((item) => item.ok).length} 张图。` }]
        for (const image of images) {
          if (image.attachment) blocks.push({ type: "image", attachment: image.attachment })
        }
        if (Array.isArray(value.prompts)) {
          blocks.push({ type: "text", text: value.prompts.map((item) => `${item.title}\n${item.prompt}`).join("\n\n") })
        }
        return blocks
      },
    },
    async execute(args) {
      const config = current()
      const input = {
        provider: args.provider || config.provider || "gemini",
        apiKey: apiKey(config),
        baseURL: config.baseURL || "",
        model: args.model || config.model || "",
        aspectRatio: args.aspect_ratio || config.aspectRatio || "3:4",
        keepOutfit: args.keep_outfit !== false,
        mode: args.mode === "sheet" ? "sheet" : "each",
        extraPrompt: args.extra_prompt || "",
        viewIds: Array.isArray(args.view_ids) ? args.view_ids : [],
      }
      if (!input.apiKey) {
        const plan = planRequest(input)
        return {
          generated: false,
          message: "没有 POSE_MUSE_API_KEY。提示词已经按大飞鱼的成年形象和所选姿势写好。若安装了 dsh-image-gen，请把每段提示词交给 edit_image 或 generate_image，并附上角色参考图与姿势线稿。不要把角色改成未成年人或 Q 版。",
          prompts: promptCards(plan),
        }
      }
      const { results } = await runGeneration(input)
      const images = []
      for (const result of results) {
        if (!result.ok || !result.imageBase64) {
          images.push({ ok: false, title: result.title, error: result.error || "没有返回图片" })
          continue
        }
        const buffer = Buffer.from(result.imageBase64, "base64")
        const saved = await persistImage(ctx, buffer, result.mediaType || "image/png", result.title)
        images.push({ ok: true, title: result.title, warning: result.warning, referencesSent: result.referencesSent, ...saved })
      }
      return {
        generated: true,
        message: `已按 ${images.length} 个姿势处理。角色是成年形象。`,
        images,
      }
    },
  }))
}
