import assert from "node:assert/strict"
import { test } from "node:test"
import { beautifyInstruction } from "./beautify.mjs"
import { messageForStatus, statusForStudioError } from "./http-status.mjs"
import { generateImage } from "./generate.mjs"
import {
  COSTUME_STYLE_PATHS,
  POSE_STYLE_PATHS,
  generateStyledReference,
  loadStyleRefs,
} from "./style-refs.mjs"

function pngBuffer() {
  return Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")
}

test("seedream watermark stays on unless costume reference generation turns it off", async () => {
  const bodies = []
  const fetchImpl = async (_url, init) => {
    bodies.push(JSON.parse(init.body))
    return new Response(JSON.stringify({ data: [{ b64_json: pngBuffer().toString("base64") }] }))
  }
  const image = { provider: "seedream", apiKey: "test-key", prompt: "衣服", images: [], aspectRatio: "3:4", fetchImpl }
  await generateImage({ ...image, watermark: false })
  await generateImage(image)
  assert.equal(bodies[0].watermark, false)
  assert.equal(bodies[1].watermark, true)
})

test("style samples are a fixed pair of catalog files", () => {
  assert.deepEqual(POSE_STYLE_PATHS, [
    "img/full_single_P015_front.png",
    "img/full_single_P001_front.png",
  ])
  assert.deepEqual(COSTUME_STYLE_PATHS, [
    "png/SUM-0174.png",
  ])
})

test("pose reference generation hands two style images to generateImage", async () => {
  const fetched = []
  let generated = null
  const image = await generateStyledReference({
    kind: "pose",
    provider: "gemini",
    apiKey: "test-key",
    prompt: "单手向前伸出",
    aspectRatio: "3:4",
    fetchPose: async (path) => {
      fetched.push(path)
      return { mediaType: "image/png", buffer: pngBuffer(), role: "pose" }
    },
    generate: async (input) => {
      generated = input
      return { mediaType: "image/png", buffer: Buffer.from("ok"), referencesSent: true }
    },
  })
  assert.equal(image.referencesSent, true)
  assert.deepEqual(fetched, [...POSE_STYLE_PATHS])
  assert.equal(generated.images.length, 2)
  assert.equal(generated.allowReferenceFallback, false)
  assert.equal(generated.watermark, undefined)
  assert.ok(generated.images.every((item) => item.mediaType === "image/jpeg" && item.buffer.byteLength >= 32))
  assert.match(generated.prompt, /单手向前伸出/)
  assert.match(generated.prompt, /严格模仿参考图的线稿风格与人偶质感，只按描述改姿态/)
})

test("costume reference generation sends only SUM-0174 and turns the watermark off", async () => {
  let generated = null
  await generateStyledReference({
    kind: "costume",
    provider: "openai",
    apiKey: "test-key",
    prompt: "米色风衣",
    fetchCostume: async (path) => {
      assert.ok(COSTUME_STYLE_PATHS.includes(path))
      return { mediaType: "image/png", buffer: pngBuffer(), role: "costume" }
    },
    generate: async (input) => {
      generated = input
      assert.ok(input.images.length >= 1)
      assert.equal(input.images.length, COSTUME_STYLE_PATHS.length)
      assert.equal(input.watermark, false)
      return { mediaType: "image/png", buffer: Buffer.from("ok"), referencesSent: true }
    },
  })
  assert.match(generated.prompt, /严格模仿参考图的构图、取景、机位距离、光线和地面柔和棚拍阴影/)
  assert.match(generated.prompt, /鞋穿在脚下/)
  assert.match(generated.prompt, /不要平铺/)
})

test("a missing style sample errors and does not call text-only generation", async () => {
  let generated = false
  await assert.rejects(() => generateStyledReference({
    kind: "pose",
    provider: "gemini",
    apiKey: "test-key",
    prompt: "举手",
    fetchPose: async (path) => {
      if (path.endsWith("P001_front.png")) throw new Error("姿势图暂时读不到（404）")
      return { mediaType: "image/png", buffer: pngBuffer(), role: "pose" }
    },
    generate: async () => {
      generated = true
      return { mediaType: "image/png", buffer: Buffer.from("ok"), referencesSent: false }
    },
  }), /姿势风格参考没有读到/)
  assert.equal(generated, false)
  await assert.rejects(() => loadStyleRefs("costume", {
    fetchCostume: async () => {
      throw new Error("服装图暂时读不到（404）")
    },
  }), /服装风格参考没有读到/)
  await assert.rejects(() => generateStyledReference({
    kind: "other",
    provider: "gemini",
    apiKey: "test-key",
    prompt: "x",
    generate: async () => {
      generated = true
    },
  }), /需要说明是姿势还是服装/)
  assert.equal(generated, false)
})

test("gateway timeouts become a readable studio error", () => {
  assert.equal(statusForStudioError(new Error("生图超时。模型这次没有在时限内返回，请再试一次。")), 504)
  assert.equal(statusForStudioError(new Error("姿势风格参考没有读到（img/a.png）。读取失败。")), 502)
  assert.equal(statusForStudioError(new Error("还没有填写 API Key")), 400)
  assert.equal(messageForStatus(504, "<html>timeout</html>", "生图失败"), "生图超时。模型这次没有在时限内返回，请再试一次。")
  assert.equal(messageForStatus(400, JSON.stringify({ error: "姿势风格参考没有读到（img/a.png）。" }), "生图失败"), "姿势风格参考没有读到（img/a.png）。")
})

test("beautify instructions tell the model to copy the reference style", () => {
  assert.match(beautifyInstruction({ kind: "pose", userPrompt: "叉腰" }), /严格模仿参考图的线稿风格与人偶质感，只按描述改姿态/)
  assert.match(beautifyInstruction({ kind: "costume", userPrompt: "风衣" }), /严格模仿参考图的构图、取景、机位距离、光线和地面柔和棚拍阴影/)
  assert.match(beautifyInstruction({ kind: "costume", userPrompt: "风衣" }), /不要裸体/)
})
