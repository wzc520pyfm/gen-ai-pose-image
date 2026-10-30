import assert from "node:assert/strict"
import { test } from "node:test"
import { searchPoses } from "./catalog.mjs"
import { searchCostumes } from "./costumes.mjs"
import { planRequest, promptCards, runGeneration } from "./jobs.mjs"
import {
  createCustomId,
  expandReferencePrompt,
  fitEdge,
  isCustomCostumeId,
  isCustomPoseId,
  isStorageHigh,
  missingCustomCostumeMessage,
  missingCustomPoseMessage,
  reuseFromHistory,
  toCostumeSearchResult,
  toPoseSearchResult,
} from "./custom.mjs"
import { beautifyPrompt, textModelFor } from "./beautify.mjs"
import {
  getCustomPoseAsset,
  listCustomCostumeAssets,
  listCustomPoseAssets,
  replaceCustomLibrary,
  resetCustomLibrary,
} from "./registry.mjs"

function tinyPngBase64() {
  const bytes = Buffer.alloc(48, 0)
  bytes[0] = 0x89
  bytes[1] = 0x50
  bytes[2] = 0x4e
  bytes[3] = 0x47
  bytes[4] = 0x0d
  bytes[5] = 0x0a
  bytes[6] = 0x1a
  bytes[7] = 0x0a
  return bytes.toString("base64")
}

test("custom ids stay distinct from catalog ids", () => {
  assert.equal(createCustomId("pose", () => "abc"), "custom-pose-abc")
  assert.equal(createCustomId("costume", () => "abc"), "custom-costume-abc")
  assert.equal(isCustomPoseId("custom-pose-abc"), true)
  assert.equal(isCustomPoseId("custom-pose-"), false)
  assert.equal(isCustomPoseId("full_single_P001"), false)
  assert.equal(isCustomCostumeId("custom-costume-abc"), true)
  assert.equal(isCustomCostumeId("SPR-0001"), false)
})

test("images are scaled down to a 2048 edge and small ones stay put", () => {
  assert.deepEqual(fitEdge(4000, 1000, 2048), { width: 2048, height: 512 })
  assert.deepEqual(fitEdge(800, 600, 2048), { width: 800, height: 600 })
  assert.throws(() => fitEdge(0, 10), /尺寸/)
})

test("storage warning trips only when usage is a large share of the quota", () => {
  assert.equal(isStorageHigh(80, 100), true)
  assert.equal(isStorageHigh(79, 100), false)
  assert.equal(isStorageHigh(10, 0), false)
})

test("reference prompts stay line-art or person-free, and safe unless adult is on", () => {
  const pose = expandReferencePrompt({ kind: "pose", userPrompt: "单手叉腰", adult: false })
  assert.match(pose, /线稿/)
  assert.match(pose, /单手叉腰/)
  assert.match(pose, /非露骨/)
  assert.match(pose, /严格模仿参考图的线稿风格与人偶质感，只按描述改姿态/)
  const costume = expandReferencePrompt({ kind: "costume", userPrompt: "", adult: false })
  assert.match(costume, /没有人物/)
  assert.match(costume, /非露骨/)
  assert.match(costume, /严格模仿参考图的平铺商品图风格，只按描述改衣服/)
  const opened = expandReferencePrompt({ kind: "pose", userPrompt: "贴近", adult: true })
  assert.match(opened, /贴近/)
  assert.match(opened, /严格模仿参考图的线稿风格与人偶质感/)
  assert.doesNotMatch(opened, /非露骨/)
})

test("history reuse restores the selection, prompt, and costume", () => {
  const restored = reuseFromHistory({
    extraPrompt: "海边黄昏",
    costume: { id: "custom-costume-coat", label: "风衣", keywords: "trench" },
    selection: [
      { poseId: "custom-pose-wave", viewId: "custom-pose-wave", title: "挥手", angle: "自定义" },
      { poseId: "", viewId: "nope" },
    ],
  })
  assert.deepEqual(restored.selected, { "custom-pose-wave": "custom-pose-wave" })
  assert.equal(restored.extraPrompt, "海边黄昏")
  assert.equal(restored.costume.id, "custom-costume-coat")
  assert.equal(restored.costume.keywords, "trench")
})

test("tool search includes custom poses and costumes without leaking image bytes", () => {
  const png = tinyPngBase64()
  resetCustomLibrary()
  replaceCustomLibrary({
    poses: [
      { id: "custom-pose-wave", label: "挥手站立", adult: false, mediaType: "image/png", dataBase64: png },
      { id: "custom-pose-hidden", label: "暴露姿势", adult: true, mediaType: "image/png", dataBase64: png },
    ],
    costumes: [
      { id: "custom-costume-coat", label: "风衣", keywords: "trench coat", adult: false, mediaType: "image/png", dataBase64: png },
      { id: "custom-costume-lace", label: "蕾丝", keywords: "lingerie lace", adult: true, mediaType: "image/png", dataBase64: png },
    ],
  })
  try {
    const poses = toPoseSearchResult(searchPoses({
      query: "挥手",
      includeAdult: false,
      limit: 12,
      custom: listCustomPoseAssets(),
    }))
    assert.equal(poses.count, 1)
    assert.equal(poses.poses[0].id, "custom-pose-wave")
    assert.equal(poses.poses[0].source, "custom")
    assert.equal(JSON.stringify(poses).includes(png), false)
    assert.equal(searchPoses({
      query: "暴露",
      includeAdult: false,
      limit: 12,
      custom: listCustomPoseAssets(),
    }).length, 0)
    const opened = searchPoses({
      query: "暴露",
      includeAdult: true,
      limit: 12,
      custom: listCustomPoseAssets(),
    })
    assert.equal(opened[0].source, "custom")
    assert.ok(searchPoses({
      systemId: "full",
      includeAdult: false,
      limit: 5,
      custom: listCustomPoseAssets(),
    }).every((pose) => pose.source !== "custom"))

    const costumes = toCostumeSearchResult(searchCostumes({
      query: "trench",
      includeAdult: false,
      limit: 12,
      custom: listCustomCostumeAssets(),
    }))
    assert.equal(costumes.costumes[0].id, "custom-costume-coat")
    assert.equal(costumes.costumes[0].source, "custom")
    assert.equal(JSON.stringify(costumes).includes(png), false)
    assert.equal(searchCostumes({
      query: "lingerie",
      includeAdult: false,
      limit: 5,
      custom: listCustomCostumeAssets(),
    }).length, 0)
    assert.equal(searchCostumes({
      category: "春",
      includeAdult: false,
      limit: 5,
      custom: listCustomCostumeAssets(),
    }).every((item) => item.source !== "custom"), true)
  } finally {
    resetCustomLibrary()
  }
})

test("generate plan accepts custom ids and refuses a missing local blob", () => {
  const png = tinyPngBase64()
  resetCustomLibrary()
  try {
    assert.throws(() => planRequest({ provider: "gemini", viewIds: ["custom-pose-missing"] }), (error) => {
      assert.equal(error.message, missingCustomPoseMessage("custom-pose-missing"))
      return true
    })
    assert.throws(() => planRequest({
      provider: "gemini",
      viewIds: ["full_single_P001"],
      costumeId: "custom-costume-missing",
    }), (error) => {
      assert.equal(error.message, missingCustomCostumeMessage("custom-costume-missing"))
      return true
    })
    const inline = planRequest({
      provider: "gemini",
      viewIds: ["custom-pose-inline"],
      costumeId: "custom-costume-inline",
      customReferences: {
        poses: [{ id: "custom-pose-inline", label: "抬腿", mediaType: "image/png", dataBase64: png }],
        costumes: [{ id: "custom-costume-inline", label: "风衣", keywords: "trench coat", mediaType: "image/png", dataBase64: png }],
      },
    })
    assert.equal(inline.items[0].source, "custom")
    assert.match(inline.items[0].prompt, /抬腿/)
    assert.match(inline.items[0].prompt, /custom-costume-inline/)
    assert.equal(JSON.stringify(promptCards(inline)).includes(png), false)

    replaceCustomLibrary({
      poses: [{ id: "custom-pose-saved", label: "挥手", adult: false, mediaType: "image/png", dataBase64: png }],
      costumes: [],
    })
    const saved = planRequest({ provider: "gemini", viewIds: ["custom-pose-saved"] })
    assert.equal(saved.items[0].source, "custom")
    assert.equal(getCustomPoseAsset("custom-pose-saved").label, "挥手")
    assert.match(saved.items[0].prompt, /挥手/)
  } finally {
    resetCustomLibrary()
  }
})

test("custom generation attaches stored blobs and does not fetch the catalog", async () => {
  const png = tinyPngBase64()
  let fetchedPose = false
  let fetchedCostume = false
  const { results } = await runGeneration({
    provider: "gemini",
    apiKey: "test-key",
    viewIds: ["custom-pose-inline"],
    costumeId: "custom-costume-inline",
    customReferences: {
      poses: [{ id: "custom-pose-inline", label: "抬腿", mediaType: "image/png", dataBase64: png }],
      costumes: [{ id: "custom-costume-inline", label: "风衣", keywords: "trench", mediaType: "image/png", dataBase64: png }],
    },
  }, {
    fetchPose: async () => {
      fetchedPose = true
      throw new Error("should not fetch a catalog pose")
    },
    fetchCostume: async () => {
      fetchedCostume = true
      throw new Error("should not fetch a catalog costume")
    },
    generate: async ({ images }) => {
      assert.deepEqual(images.map((image) => image.role), ["character", "costume", "pose"])
      return { mediaType: "image/png", buffer: Buffer.from("ok"), referencesSent: true }
    },
  })
  assert.equal(fetchedPose, false)
  assert.equal(fetchedCostume, false)
  assert.equal(results[0].ok, true)
})

test("beautify uses the provider text API and falls back to the local template", async () => {
  assert.equal(textModelFor("gemini", "gemini-2.5-flash-image"), "gemini-2.5-flash")
  assert.equal(textModelFor("openai", "gpt-image-1"), "gpt-4o-mini")
  assert.equal(textModelFor("seedream", "doubao-seedream-5-0-flash-260915"), "doubao-seed-2-1-pro-260628")
  assert.equal(textModelFor("seedream", ""), "doubao-seed-2-1-pro-260628")
  const offline = await beautifyPrompt({
    provider: "gemini",
    apiKey: "",
    kind: "pose",
    userPrompt: "叉腰",
    adult: false,
    fetchImpl: async () => {
      throw new Error("should not be called")
    },
  })
  assert.equal(offline.source, "template")
  assert.match(offline.prompt, /叉腰/)
  assert.match(offline.prompt, /线稿/)

  const live = await beautifyPrompt({
    provider: "gemini",
    apiKey: "test-key",
    model: "gemini-2.5-flash-image",
    kind: "costume",
    userPrompt: "牛仔外套",
    adult: false,
    fetchImpl: async (url) => {
      assert.match(String(url), /gemini-2\.5-flash:/)
      assert.doesNotMatch(String(url), /flash-image/)
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "白底牛仔外套平铺，没有人物。" }] } }],
      }), { status: 200 })
    },
  })
  assert.equal(live.source, "model")
  assert.match(live.prompt, /牛仔外套/)

  const failed = await beautifyPrompt({
    provider: "openai",
    apiKey: "test-key",
    model: "gpt-image-1",
    kind: "pose",
    userPrompt: "举手",
    adult: false,
    fetchImpl: async (url, init) => {
      assert.match(String(url), /\/chat\/completions$/)
      const body = JSON.parse(init.body)
      assert.equal(body.model, "gpt-4o-mini")
      return new Response(JSON.stringify({ error: { message: "no such model" } }), { status: 404 })
    },
  })
  assert.equal(failed.source, "template")
  assert.match(failed.prompt, /举手/)
  assert.match(failed.notice, /本地扩写/)
  assert.match(failed.notice, /no such model/)

  const secret = "ark-secret-value"
  const seedream = await beautifyPrompt({
    provider: "seedream",
    apiKey: secret,
    model: "doubao-seedream-5-0-flash-260915",
    kind: "pose",
    userPrompt: "举手",
    adult: false,
    fetchImpl: async (url, init) => {
      assert.match(String(url), /\/chat\/completions$/)
      const body = JSON.parse(init.body)
      assert.equal(body.model, "doubao-seed-2-1-pro-260628")
      return new Response(JSON.stringify({
        error: {
          code: "InvalidEndpointOrModel.NotFound",
          message: `The model does not exist for ${secret}`,
        },
      }), { status: 404 })
    },
  })
  assert.equal(seedream.source, "template")
  assert.match(seedream.prompt, /举手/)
  assert.match(seedream.notice, /文本接口不可用，已改用本地扩写。/)
  assert.match(seedream.notice, /InvalidEndpointOrModel\.NotFound/)
  assert.match(seedream.notice, /The model does not exist/)
  assert.doesNotMatch(seedream.notice, /ark-secret-value/)
})
