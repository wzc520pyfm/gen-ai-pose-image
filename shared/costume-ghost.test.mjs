import assert from "node:assert/strict"
import { test } from "node:test"
import sharp from "sharp"
import {
  classifyCostumeLayer,
  costumeLayerPrompt,
  costumeRemovalPrompt,
  costumeWearPrompt,
  ensureWearPrompt,
  generateGhostCostume,
  prepareCostumeLayerImage,
  selectGhostLayers,
  supportsCostumeLayerSplit,
} from "./costume-ghost.mjs"
import { decomposeSeedreamImage, parseSeedreamLayers } from "./generate.mjs"

const SENSITIVE = /裸体|裸露|内衣|性暗示|色情|皮肤|露骨|暴露/

function tinyPng() {
  return Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")
}

async function solid(width, height, color) {
  return sharp({
    create: { width, height, channels: 4, background: color },
  }).png().toBuffer()
}

async function pixel(buffer, x, y) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const index = (y * info.width + x) * info.channels
  return [data[index], data[index + 1], data[index + 2]]
}

test("layer names keep garments and drop the person", () => {
  assert.equal(classifyCostumeLayer({ name: "粉色贝雷帽" }), "keep")
  assert.equal(classifyCostumeLayer({ name: "爱心袜" }), "keep")
  assert.equal(classifyCostumeLayer({ name: "手套", description: "白色" }), "keep")
  assert.equal(classifyCostumeLayer({ name: "小腿袜" }), "keep")
  assert.equal(classifyCostumeLayer({ name: "pink beret" }), "keep")
  assert.equal(classifyCostumeLayer({ name: "头部" }), "drop")
  assert.equal(classifyCostumeLayer({ name: "双腿" }), "drop")
  assert.equal(classifyCostumeLayer({ name: "腿" }), "drop")
  assert.equal(classifyCostumeLayer({ name: "head" }), "drop")
  assert.equal(classifyCostumeLayer({ name: "穿着风衣的模特" }), "mixed")
  assert.equal(classifyCostumeLayer({ name: "背景" }), "skip")
  assert.equal(classifyCostumeLayer({ name: "" }), "unknown")
  const selected = selectGhostLayers([
    { name: "粉色贝雷帽", zIndex: 2 },
    { name: "头部", zIndex: 3 },
    { name: "双腿", zIndex: 4 },
    { name: "背景", zIndex: 1 },
  ])
  assert.equal(selected.ok, true)
  assert.deepEqual(selected.keep.map((layer) => layer.name), ["粉色贝雷帽"])
  assert.equal(selectGhostLayers([{ name: "米色风衣" }]).ok, false)
  assert.equal(selectGhostLayers([{ name: "头部" }]).ok, false)
  assert.equal(selectGhostLayers([{ name: "穿着风衣的模特" }]).ok, false)
  const mixed = selectGhostLayers([{ name: "贝雷帽" }, { name: "穿着风衣的模特" }])
  assert.equal(mixed.ok, false)
  assert.match(mixed.reason, /人物图层/)
})

test("wear prompts put the hat on a head and strip old ghost locks", () => {
  const wrapped = costumeWearPrompt({
    userPrompt: "不要人，不要头。帽子悬在领口上方，不能贴在衣领上。粉色贝雷帽，米色风衣。",
  })
  assert.match(wrapped, /这一步先画成年模特穿着衣服/)
  assert.match(wrapped, /帽子戴在头上/)
  assert.match(wrapped, /粉色贝雷帽/)
  assert.match(wrapped, /米色风衣/)
  assert.match(wrapped, /不要自行加丝袜、连裤袜或打底裤/)
  assert.doesNotMatch(wrapped, /帽子悬在领口上方/)
  assert.doesNotMatch(wrapped, /不要人，不要头/)
  const softened = costumeWearPrompt({ userPrompt: "白色衬衫", sensitivePromptOptimize: true })
  assert.doesNotMatch(softened, SENSITIVE)
  assert.doesNotMatch(costumeRemovalPrompt(true), SENSITIVE)
  assert.doesNotMatch(costumeLayerPrompt(true), SENSITIVE)
  assert.match(costumeRemovalPrompt(false), /皮肤/)
  assert.match(costumeLayerPrompt(false), /皮肤/)
  const existing = "这一步先画成年模特穿着衣服。只穿白衬衫。"
  assert.equal(ensureWearPrompt(existing), existing)
})

test("only seedream 5 pro and flash can split costume layers", () => {
  assert.equal(supportsCostumeLayerSplit("seedream", ""), true)
  assert.equal(supportsCostumeLayerSplit("seedream", "doubao-seedream-5-0-flash-260915"), true)
  assert.equal(supportsCostumeLayerSplit("seedream", "doubao-seedream-5-0-pro-260628"), true)
  assert.equal(supportsCostumeLayerSplit("seedream", "doubao-seedream-5-0-lite-250821"), false)
  assert.equal(supportsCostumeLayerSplit("seedream", "doubao-seedream-4-5-251128"), false)
  assert.equal(supportsCostumeLayerSplit("gemini", "gemini-2.5-flash-image"), false)
  assert.equal(supportsCostumeLayerSplit("openai", "gpt-image-1"), false)
})

test("ghost composite keeps the garment and leaves the person out", async () => {
  const person = await solid(10, 10, { r: 30, g: 30, b: 220, alpha: 1 })
  const base = await sharp(await solid(40, 50, { r: 180, g: 180, b: 180, alpha: 1 }))
    .composite([{ input: person, left: 4, top: 30 }])
    .png()
    .toBuffer()
  const garment = await solid(10, 10, { r: 220, g: 30, b: 30, alpha: 1 })
  const image = await generateGhostCostume({
    provider: "seedream",
    model: "doubao-seedream-5-0-flash-260915",
    apiKey: "test-key",
    prompt: "粉色贝雷帽，米色风衣",
    aspectRatio: "3:4",
    generate: async (input) => {
      assert.equal(input.images.length, 0)
      assert.equal(input.watermark, false)
      assert.match(input.prompt, /这一步先画成年模特穿着衣服/)
      assert.match(input.prompt, /粉色贝雷帽/)
      return { mediaType: "image/png", buffer: tinyPng(), referencesSent: false }
    },
    decompose: async (input) => {
      assert.match(input.prompt, /拆成独立图层/)
      assert.match(input.prompt, /皮肤/)
      assert.equal(input.image.buffer.length, tinyPng().length)
      return {
        base: { buffer: base, mediaType: "image/png" },
        layers: [
          { name: "粉色贝雷帽", zIndex: 2, absolute: [4, 4, 14, 14], buffer: garment },
          { name: "双腿", zIndex: 3, absolute: [4, 30, 14, 40], buffer: person },
        ],
      }
    },
  })
  assert.match(image.warning, /按图层抠掉人物/)
  assert.deepEqual(await pixel(image.buffer, 8, 8), [220, 30, 30])
  assert.deepEqual(await pixel(image.buffer, 8, 34), [180, 180, 180])
})

test("a failed layer split falls back to one edit and never returns the worn photo", async () => {
  const prompts = []
  const worn = await solid(16, 16, { r: 1, g: 2, b: 3, alpha: 1 })
  const edited = await solid(16, 16, { r: 9, g: 9, b: 9, alpha: 1 })
  const image = await generateGhostCostume({
    provider: "seedream",
    model: "doubao-seedream-4-5-251128",
    apiKey: "test-key",
    prompt: "格纹短裙",
    sensitivePromptOptimize: true,
    generate: async (input) => {
      prompts.push(input.prompt)
      if (prompts.length === 1) return { mediaType: "image/png", buffer: worn, referencesSent: false }
      assert.equal(input.images.length, 1)
      assert.equal(input.allowReferenceFallback, false)
      assert.equal(input.watermark, false)
      assert.equal(input.images[0].buffer.equals(worn), true)
      return { mediaType: "image/png", buffer: edited, referencesSent: true }
    },
    decompose: async () => {
      throw new Error("should not split an older seedream model")
    },
  })
  assert.equal(prompts.length, 2)
  assert.match(prompts[1], /去掉人物/)
  assert.doesNotMatch(prompts[1], SENSITIVE)
  assert.match(image.warning, /不能拆图层/)
  assert.equal(image.buffer.equals(edited), true)
  assert.equal(image.buffer.equals(worn), false)

  let attempts = 0
  await assert.rejects(() => generateGhostCostume({
    provider: "gemini",
    apiKey: "test-key",
    prompt: "风衣",
    generate: async () => {
      attempts += 1
      if (attempts === 1) return { mediaType: "image/png", buffer: worn, referencesSent: false }
      throw new Error("去人编辑失败")
    },
  }), /不会把带着人的图存成服装参考/)
  assert.equal(attempts, 2)
})

test("seedream layer split posts one jpeg and reads every returned layer", async () => {
  await assert.rejects(() => prepareCostumeLayerImage({ buffer: tinyPng() }), /512/)

  const source = await sharp({
    create: { width: 512, height: 512, channels: 3, background: { r: 200, g: 200, b: 200 } },
  }).jpeg().toBuffer()
  const layerPng = tinyPng().toString("base64")
  let body = null
  const split = await decomposeSeedreamImage({
    apiKey: "test-key",
    baseURL: "https://ark.example.com/api/v3",
    model: "doubao-seedream-5-0-flash-260915",
    prompt: "拆成独立图层",
    image: { mediaType: "image/jpeg", buffer: source },
    fetchImpl: async (url, init) => {
      assert.equal(url, "https://ark.example.com/api/v3/images/generations")
      body = JSON.parse(init.body)
      return new Response(JSON.stringify({
        data: [
          { b64_json: layerPng, output_format: "png", z_index: 0 },
          {
            b64_json: layerPng,
            output_format: "png",
            z_index: 1,
            name: "贝雷帽",
            description: "粉色",
            bounding_box: { absolute: [1, 2, 3, 4], normalized: [10, 20, 30, 40] },
          },
        ],
      }))
    },
  })
  assert.equal(body.layer_decomposition, true)
  assert.equal(body.size, "auto")
  assert.equal(body.watermark, false)
  assert.equal(body.output_format, "png")
  assert.equal(typeof body.image, "string")
  assert.match(body.image, /^data:image\/jpeg;base64,/)
  assert.equal(split.layers.length, 1)
  assert.equal(split.layers[0].name, "贝雷帽")
  assert.deepEqual(split.layers[0].absolute, [1, 2, 3, 4])
  assert.throws(() => parseSeedreamLayers({ data: [{ b64_json: layerPng }] }), /没有返回图层/)
})
