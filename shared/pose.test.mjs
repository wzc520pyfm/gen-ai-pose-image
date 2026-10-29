import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { DEFAULT_CHARACTER } from "./character.mjs"
import { getCatalog, resolveView, searchPoses } from "./catalog.mjs"
import { getCostume, isSafeCostumePath, searchCostumes } from "./costumes.mjs"
import { extractGeminiImage, extractOpenAIImage, openAISize, redact, seedreamSize } from "./generate.mjs"
import { isSafePosePath, modelImage, planRequest, promptCards } from "./jobs.mjs"
import { composePrompt } from "./prompt.mjs"
import { PROJECT_LICENSE, licenseNotices } from "./license.mjs"

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
  assert.match(text, /大飞鱼/)
  assert.match(text, /鲸尾/)
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
  assert.match(plan.items[0].prompt, /大飞鱼/)
  assert.equal(promptCards(plan).length, 2)
})

test("a chosen costume replaces the locked outfit", () => {
  const costume = getCostume("SPR-0001")
  assert.ok(costume)
  assert.equal(costume.adult, false)
  const text = composePrompt({
    character: DEFAULT_CHARACTER,
    poses: [{ name: "站立", category: "站姿", system: "全身单人・标准系", angle: "正面", people: 1 }],
    keepOutfit: true,
    costume: { id: costume.id, keywords: costume.keywords },
  })
  assert.match(text, /服装编号 SPR-0001/)
  assert.match(text, /ivory frill knit/)
  assert.match(text, /鲸耳/)
  assert.match(text, /鲸尾/)
  assert.match(text, /不要画出服装图里的人台/)
  assert.match(text, /原服装，以及第一张参考图上的衣服，这次都不要保留/)
  assert.doesNotMatch(text, /必须保留角色参考图中的服装/)
  const plan = planRequest({
    provider: "gemini",
    viewIds: ["full_single_P001"],
    costumeId: "SPR-0001",
    keepOutfit: true,
  })
  assert.equal(plan.costume.id, "SPR-0001")
  assert.match(plan.items[0].prompt, /服装编号 SPR-0001/)
  assert.doesNotMatch(plan.items[0].prompt, /必须保留角色参考图中的服装/)
  assert.throws(() => planRequest({ provider: "gemini", viewIds: ["full_single_P001"], costumeId: "NO-SUCH" }), /找不到服装/)
  assert.equal(isSafeCostumePath("img/SPR-0001.webp"), true)
  assert.equal(isSafeCostumePath("png/SWM-0001.png"), true)
  assert.equal(isSafeCostumePath("../.env"), false)
  const spring = searchCostumes({ category: "春", includeAdult: false, limit: 5 })
  assert.equal(spring.length, 5)
  assert.ok(spring.every((item) => item.adult === false && item.category === "春"))
  assert.equal(searchCostumes({ category: "ランジェリー", includeAdult: false, limit: 5 }).length, 0)
  const opened = searchCostumes({ category: "ランジェリー", includeAdult: true, limit: 3 })
  assert.equal(opened.length, 3)
  assert.ok(opened.every((item) => item.adult))
})

test("webp costume references become jpeg before they are sent", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pose-muse-test-"))
  try {
    const source = join(dir, "swatch.webp")
    const made = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=red:s=16x16", "-frames:v", "1", source])
    assert.equal(made.status, 0)
    const converted = await modelImage({ mediaType: "image/webp", buffer: readFileSync(source), role: "costume" })
    assert.equal(converted.mediaType, "image/jpeg")
    assert.equal(converted.buffer[0], 0xff)
    assert.equal(converted.buffer[1], 0xd8)
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const kept = await modelImage({ mediaType: "image/png", buffer: png, role: "character" })
    assert.equal(kept.buffer, png)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("project license is MIT and names every outside source", () => {
  const license = readFileSync(new URL("../LICENSE", import.meta.url), "utf8")
  assert.equal(PROJECT_LICENSE.spdx, "MIT")
  assert.match(license, /^MIT License/)
  assert.match(license, new RegExp(PROJECT_LICENSE.copyright.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  assert.doesNotMatch(license, /Apache/)
  assert.doesNotMatch(license, /shanliuling/)
  const notices = licenseNotices()
  assert.match(notices, /ギア/)
  assert.match(notices, /Anhao/)
  assert.match(notices, /TreapGoGo/)
  assert.match(notices, /DeepSeek/)
  assert.ok(license.endsWith(`${notices}\n`))
})

test("image helpers stay inside the public gallery", () => {
  assert.equal(isSafePosePath("thumbs/full_single_P001_front.jpg"), true)
  assert.equal(isSafePosePath("../.env"), false)
  assert.equal(isSafePosePath("https://evil.example/a.jpg"), false)
  assert.equal(openAISize("3:4"), "1024x1536")
  assert.equal(seedreamSize("3:4"), "1728x2304")
  assert.equal(seedreamSize("16:9"), "2848x1600")
  assert.equal(openAISize("16:9"), "1536x1024")
  assert.equal(redact("key sk-test failed", "sk-test"), "key *** failed")
  const gemini = extractGeminiImage({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "aaaa" } }] } }] })
  assert.equal(gemini.base64, "aaaa")
  const openai = extractOpenAIImage({ data: [{ b64_json: "bbbb" }] })
  assert.equal(openai.base64, "bbbb")
})
