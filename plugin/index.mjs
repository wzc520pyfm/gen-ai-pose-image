import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createRequire } from "node:module"
import { searchPoses } from "../shared/catalog.mjs"
import { searchCostumes } from "../shared/costumes.mjs"
import { searchFaces, toFaceSearchResult } from "../shared/faces.mjs"
import { toCostumeSearchResult, toPoseSearchResult } from "../shared/custom.mjs"
import { planRequest, promptCards, runGeneration } from "../shared/jobs.mjs"
import { listCustomCostumeAssets, listCustomPoseAssets } from "../shared/registry.mjs"
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
          "默认可一次选择多个姿势。默认模特是成年女性「大肥鱼」（社区 DeepSeek 鲸鱼娘的成年形象，蓝发、鲸耳、鲸尾、蓝白女仆装）。不要把角色画成未成年人或 Q 版。",
          "要换衣服时，先用 search_costumes 找没有人物的服装图，再把返回的 id 作为 costume_id 传给 generate_pose_images。换装仍保留脸、发型、鲸耳和鲸尾。内衣、泳装和性感分类默认隐藏。",
          "要换脸或表情时，先用 search_faces 找脸部参考，再把返回的 id 作为 face_id 传给 generate_pose_images。脸部参考只提供五官、表情、脸型和发型；姿势和服装仍按各自的参考图。角色原有的鲸耳和鲸尾保留。脸库作者是ギア，许可是 CC0。",
          "工作室里上传或生成的自定义姿势和服装会带 source 为 custom。这些 id 可以直接交给 generate_pose_images。如果工具说找不到自定义参考图，请让用户先在澜姿工作室上传或生成，不要改用图库里的其他姿势或服装。",
          "没有 POSE_MUSE_API_KEY 时，generate_pose_images 会返回提示词；若 dsh-image-gen 可用，把提示词原样交给 edit_image 或 generate_image，并附上角色参考与姿势线稿。",
        ].join("\n"),
      }), "dsh-pose-muse prompt")
    })
  }

  const defineTool = loadDefineTool()
  ctx.tools.register(defineTool({
    name: "search_poses",
    description: "Search the Chinese AI pose gallery (ai-pose-gallery-zh): 288 pose groups and 1439 angle views, plus custom poses saved in the Lanpose studio on this machine. Custom hits have source custom. Use before generate_pose_images. Adult categories stay hidden unless include_adult is true.",
    parameters: {
      query: { type: "string", description: "Pose name, code such as P001, category, or id." },
      system_id: { type: "string", enum: ["full", "sexy", "bust", "pair"], description: "full=标准全身, sexy=性感全身, bust=上半身, pair=双人. Omit to search all visible poses." },
      category: { type: "string", description: "Exact category name, for example 站姿 or 坐姿." },
      include_adult: { type: "boolean", description: "Include sexy and couple poses. Default false." },
      limit: { type: "integer", description: "Max results, 1-30. Default 12." },
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }],
    },
    async execute(args) {
      return toPoseSearchResult(searchPoses({
        query: args.query ?? "",
        systemId: args.system_id ?? "",
        category: args.category ?? "",
        includeAdult: args.include_adult === true,
        limit: args.limit ?? 12,
        custom: listCustomPoseAssets(),
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: "search_faces",
    description: "Search the CC0 face and expression library by ギア (ai-portrait-gallery.pages.dev): 1499 portrait references in 脸部特写 and 造型, filterable by hair length. Chinese section and style labels follow sleepy-zone/ai-ref-library-cn. Use a returned id as face_id in generate_pose_images. The tool does not return image bytes; generation loads the public original on demand.",
    parameters: {
      query: { type: "string", description: "Face id such as f009cba9893, Chinese or Japanese style label, section, or hair length." },
      section: { type: "string", enum: ["脸部特写", "造型"], description: "脸部特写 is a plain-background face close-up. 造型 includes styling. Omit to search both." },
      hair: { type: "string", enum: ["短发", "中发", "中长发", "长发"], description: "Hair length filter. Omit to search every length." },
      limit: { type: "integer", description: "Max results, 1-30. Default 12." },
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }],
    },
    async execute(args) {
      const limit = Math.max(1, Math.min(30, Number(args.limit) || 12))
      return toFaceSearchResult(searchFaces({
        query: args.query ?? "",
        section: args.section ?? "",
        hair: args.hair ?? "",
        limit,
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: "search_costumes",
    description: "Search clothing-only references from the costume gallery at ai-costume-gallery.pages.dev, plus custom costumes saved in the Lanpose studio on this machine. Custom hits have source custom. Images contain garments, not people. Use a returned id as costume_id in generate_pose_images. Lingerie, swimwear, and sexy categories stay hidden unless include_adult is true.",
    parameters: {
      query: { type: "string", description: "Costume id such as SPR-0001, or English keywords such as denim coat." },
      category: { type: "string", enum: ["春", "夏", "秋", "冬", "パーティ", "ランジェリー", "水着", "セクシー"], description: "春=spring, 夏=summer, 秋=autumn, 冬=winter, パーティ=party, ランジェリー=lingerie, 水着=swimwear, セクシー=sexy." },
      include_adult: { type: "boolean", description: "Include lingerie, swimwear, and sexy outfits. Default false." },
      limit: { type: "integer", description: "Max results, 1-30. Default 12." },
    },
    output: {
      schema: { type: "object", additionalProperties: true },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }],
    },
    async execute(args) {
      const limit = Math.max(1, Math.min(30, Number(args.limit) || 12))
      return toCostumeSearchResult(searchCostumes({
        query: args.query ?? "",
        category: args.category ?? "",
        includeAdult: args.include_adult === true,
        limit,
        custom: listCustomCostumeAssets(),
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: "generate_pose_images",
    description: "Generate images of the default adult whale-girl 大肥鱼, or describe a wardrobe change, using one or more pose references from search_poses. Custom pose and costume ids from the studio are accepted when their reference images are on this machine. If a custom id has no local image, the tool returns an error and does not substitute a catalog item. Pass view ids (or pose ids, which use the front view). Keeps the character's maid outfit unless keep_outfit is false or costume_id is set. costume_id swaps clothing from search_costumes while keeping the face, hair, whale ears, and whale tail. face_id applies a face and expression reference from search_faces: facial features, expression, and hairstyle come from that image, while pose and costume references still apply and whale ears and tail stay. Reference order is character, optional face, optional costume, then pose. One image per pose unless mode is sheet.",
    parameters: {
      view_ids: { type: "array", items: { type: "string" }, required: true, description: "Pose or view ids from search_poses, including custom-pose ids. Up to 8 for each, 4 for sheet." },
      costume_id: { type: "string", description: "Optional costume id from search_costumes, such as SPR-0001 or a custom-costume id. The clothing-only reference replaces the maid outfit." },
      face_id: { type: "string", description: "Optional face id from search_faces, such as f009cba9893. The public portrait is sent as a face and expression reference." },
      extra_prompt: { type: "string", description: "Optional scene, lighting, or wardrobe note." },
      keep_outfit: { type: "boolean", description: "Keep 大肥鱼's blue-and-white maid outfit, whale ears and tail. Default true. Ignored when costume_id is set." },
      aspect_ratio: { type: "string", enum: ["1:1", "3:4", "4:3", "9:16", "16:9"], description: "Default 3:4." },
      mode: { type: "string", enum: ["each", "sheet"], description: "each makes one image per pose. sheet puts up to 4 poses in one image." },
      provider: { type: "string", enum: ["seedream", "gemini", "openai"], description: "Omit to use the plugin default. seedream calls Volcengine Ark." },
      model: { type: "string", description: "Optional model override." },
    },
    output: {
      schema: { type: "object", additionalProperties: true },
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
        costumeId: typeof args.costume_id === "string" ? args.costume_id : "",
        faceId: typeof args.face_id === "string" ? args.face_id : "",
        viewIds: Array.isArray(args.view_ids) ? args.view_ids : [],
      }
      if (!input.apiKey) {
        const plan = planRequest(input)
        const usesCustom = plan.items.some((item) => item.source === "custom") || plan.costume?.source === "custom"
        const customNote = usesCustom ? "这次用了工作室里的自定义参考。交给 dsh-image-gen 时请附上这些本地图片，不要换成图库里的其他姿势或服装。" : ""
        const faceNote = input.faceId ? "参考图顺序是角色、脸部参考、可选的没有人物的服装图、姿势线稿。脸部参考只用于五官、表情、脸型和发型。" : ""
        return {
          generated: false,
          message: input.costumeId
            ? `没有 POSE_MUSE_API_KEY。提示词已经按大肥鱼的成年形象、所选服装和姿势写好。若安装了 dsh-image-gen，请把每段提示词交给 edit_image 或 generate_image，并按顺序附上角色参考、没有人物的服装图和姿势线稿。${faceNote}不要把角色改成未成年人或 Q 版。${customNote}`
            : `没有 POSE_MUSE_API_KEY。提示词已经按大肥鱼的成年形象和所选姿势写好。若安装了 dsh-image-gen，请把每段提示词交给 edit_image 或 generate_image，并附上角色参考图与姿势线稿。${faceNote}不要把角色改成未成年人或 Q 版。${customNote}`,
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
