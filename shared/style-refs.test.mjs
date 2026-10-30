import assert from "node:assert/strict"
import { test } from "node:test"
import { beautifyInstruction } from "./beautify.mjs"
import {
  COSTUME_STYLE_PATHS,
  POSE_STYLE_PATHS,
  generateStyledReference,
  loadStyleRefs,
} from "./style-refs.mjs"

function pngBuffer() {
  const bytes = Buffer.alloc(64, 0)
  bytes[0] = 0x89
  bytes[1] = 0x50
  bytes[2] = 0x4e
  bytes[3] = 0x47
  return bytes
}

test("style samples are a fixed pair of catalog files", () => {
  assert.deepEqual(POSE_STYLE_PATHS, [
    "img/full_single_P015_front.png",
    "img/full_single_P001_front.png",
  ])
  assert.deepEqual(COSTUME_STYLE_PATHS, [
    "png/SPR-0001.png",
    "png/SUM-0001.png",
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
  assert.ok(generated.images.every((item) => item.buffer.byteLength >= 32))
  assert.match(generated.prompt, /单手向前伸出/)
  assert.match(generated.prompt, /严格模仿参考图的线稿风格与人偶质感，只按描述改姿态/)
})

test("costume reference generation hands the flat-lay samples and never an empty list", async () => {
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
      return { mediaType: "image/png", buffer: Buffer.from("ok"), referencesSent: true }
    },
  })
  assert.match(generated.prompt, /严格模仿参考图的平铺商品图风格，只按描述改衣服/)
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

test("beautify instructions tell the model to copy the reference style", () => {
  assert.match(beautifyInstruction({ kind: "pose", userPrompt: "叉腰" }), /严格模仿参考图的线稿风格与人偶质感，只按描述改姿态/)
  assert.match(beautifyInstruction({ kind: "costume", userPrompt: "风衣" }), /严格模仿参考图的平铺商品图风格，只按描述改衣服/)
})
