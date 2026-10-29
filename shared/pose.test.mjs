import assert from "node:assert/strict"
import { test } from "node:test"
import { DEFAULT_CHARACTER } from "./character.mjs"
import { getCatalog, resolveView, searchPoses } from "./catalog.mjs"
import { extractGeminiImage, extractOpenAIImage, openAISize, redact } from "./generate.mjs"
import { isSafePosePath, planRequest, promptCards } from "./jobs.mjs"
import { composePrompt } from "./prompt.mjs"

test("catalog keeps every translated pose and view", () => {
  const catalog = getCatalog()
  assert.equal(catalog.poseCount, 288)
  assert.equal(catalog.viewCount, 1439)
  assert.equal(catalog.poses.length, 288)
  assert.equal(catalog.systems.reduce((sum, system) => sum + system.poseCount, 0), 288)
})

test("search stays on safe poses unless adult poses are included", () => {
  const safe = searchPoses({ query: "站姿", includeAdult: false, limit: 50 })
  assert.ok(safe.length > 0)
  assert.ok(safe.every((pose) => pose.adult === false))
  const adult = searchPoses({ query: "骑乘", includeAdult: true, limit: 10 })
  assert.ok(adult.some((pose) => pose.adult))
  assert.equal(searchPoses({ query: "骑乘", includeAdult: false, limit: 10 }).length, 0)
})

test("pose ids and view ids both resolve", () => {
  const pose = getCatalog().poses.find((item) => item.systemId === "full")
  assert.ok(pose)
  const resolved = resolveView(pose.id)
  assert.equal(resolved.view.angle, "正面")
  assert.equal(resolveView(pose.views[0].id).view.id, pose.views[0].id)
  assert.equal(resolveView("missing"), undefined)
})

test("prompt locks the adult default character and the chosen pose", () => {
  const text = composePrompt({
    character: DEFAULT_CHARACTER,
    poses: [{ name: "后仰坐・单膝立起", category: "坐姿", system: "全身单人・标准系", angle: "正面", people: 1 }],
    keepOutfit: true,
    mode: "each",
  })
  assert.match(text, /澜/)
  assert.match(text, /二十五岁/)
  assert.match(text, /禁止画成儿童/)
  assert.match(text, /后仰坐・单膝立起/)
  assert.match(text, /必须保留角色参考图中的服装/)
  const changed = composePrompt({
    character: DEFAULT_CHARACTER,
    poses: [{ name: "双人", category: "贴脸系", system: "双人缠绵", angle: "侧面", people: 2 }],
    keepOutfit: false,
    extraPrompt: "换成风衣",
    mode: "each",
  })
  assert.match(changed, /另一人/)
  assert.match(changed, /换成风衣/)
  assert.doesNotMatch(changed, /必须保留角色参考图中的服装/)
})

test("plan rejects unknown poses and builds one prompt per view", () => {
  assert.throws(() => planRequest({ provider: "gemini", viewIds: [] }), /至少一个姿势/)
  assert.throws(() => planRequest({ provider: "gemini", viewIds: ["nope"] }), /找不到姿势/)
  const pose = getCatalog().poses.find((item) => item.id === "full_single_P001")
  const plan = planRequest({
    provider: "openai",
    viewIds: [pose.id, pose.views[1].id],
    mode: "each",
    aspectRatio: "16:9",
  })
  assert.equal(plan.items.length, 2)
  assert.equal(plan.aspectRatio, "16:9")
  assert.equal(plan.model, "gpt-image-1")
  assert.match(plan.items[0].prompt, /澜/)
  assert.equal(promptCards(plan).length, 2)
})

test("image helpers stay inside the public gallery", () => {
  assert.equal(isSafePosePath("thumbs/full_single_P001_front.jpg"), true)
  assert.equal(isSafePosePath("../.env"), false)
  assert.equal(isSafePosePath("https://evil.example/a.jpg"), false)
  assert.equal(openAISize("3:4"), "1024x1536")
  assert.equal(openAISize("16:9"), "1536x1024")
  assert.equal(redact("key sk-test failed", "sk-test"), "key *** failed")
  const gemini = extractGeminiImage({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "aaaa" } }] } }] })
  assert.equal(gemini.base64, "aaaa")
  const openai = extractOpenAIImage({ data: [{ b64_json: "bbbb" }] })
  assert.equal(openai.base64, "bbbb")
})
