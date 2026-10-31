import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { activeGraph, buildLocalGraph, comfyURL, dimensions, localPrompts, composeLocalSheet, generateLocal, assertLocalRequest } from "./comfyui.mjs"
import { planRequest, runGeneration } from "./jobs.mjs"
import sharp from "sharp"

process.env.LANPOSE_COMFYUI = "1"
const file = { characters: ["person.png"], garment: "clothes.png", pose: "pose.png" }
const pose = { name: "双手抬起", angle: "正面", category: "站姿", people: 1 }

test("local endpoint is opt-in, loopback only, without credentials or redirectable paths", () => {
  assert.throws(() => comfyURL({}), /未启用/)
  for (const url of ["http://example.com", "http://127.0.0.1.evil.example", "http://user:pass@localhost", "http://localhost/a", "http://localhost?x=1", "file:///tmp/a"]) assert.throws(() => comfyURL({ LANPOSE_COMFYUI: "1", LANPOSE_COMFYUI_URL: url }))
  assert.equal(comfyURL({ LANPOSE_COMFYUI: "1" }), "http://127.0.0.1:8188")
  assert.throws(() => assertLocalRequest("http://localhost:3000", "https://evil.example"))
  assert.throws(() => assertLocalRequest("https://public.example"))
  assert.doesNotThrow(() => assertLocalRequest("http://localhost:3000", "http://localhost:3000"))
})

test("the unified graph prunes unused models and only retains selected samplers", async () => {
  for (const [hasOutfit, hasPose, expected] of [[true, false, 1], [false, true, 1], [true, true, 2]]) {
    const { graph } = await buildLocalGraph({ files: file, costume: hasOutfit, pose: hasPose && pose, aspectRatio: "3:4", seed: 123 })
    const types = Object.values(graph).map((n) => n.class_type)
    assert.equal(types.includes("MOSSImageControl"), Boolean(hasPose))
    assert.equal(types.filter((t) => t === "SamplerCustomAdvanced").length, expected)
    assert.ok(!types.includes("ComfySwitchNode"))
    for (const n of Object.values(graph)) for (const v of Object.values(n.inputs)) if (Array.isArray(v)) assert.ok(graph[v[0]])
    assert.equal(graph["11"].inputs.noise_seed, 123)
  }
  const { graph } = await buildLocalGraph({ files: { ...file, characters: ["one.png", "two.png", "three.png", "four.png"] }, costume: true, pose, aspectRatio: "16:9" })
  assert.equal(graph["207"].inputs["images.image_7"][0], "503")
  assert.equal(graph["114"].inputs.width, dimensions("16:9")[0])
  assert.equal(graph["501"].inputs.image, "two.png")
})

test("graph cycles and broken mappings fail instead of recurring forever", () => {
  assert.throws(() => activeGraph({ a: { class_type: "X", inputs: { x: ["a", 0] } } }, "a"), /循环/)
  assert.throws(() => activeGraph({ a: { class_type: "X", inputs: { x: ["b", 0] } } }, "a"), /不存在/)
})

test("canvas links and widgets match API graph and expose branch switches", async () => {
  const { graph } = JSON.parse(await readFile(new URL("./workflows/local-tryon.api.json", import.meta.url)))
  const canvas = JSON.parse(await readFile(new URL("./workflows/local-tryon.canvas.json", import.meta.url)))
  for (const [id, n] of Object.entries(graph)) {
    const c = canvas.nodes.find((c) => String(c.id) === id)
    assert.equal(c.type, n.class_type)
    for (const [key, value] of Object.entries(n.inputs)) {
      if (!Array.isArray(value)) continue
      const index = c.inputs.findIndex((i) => i.name === key)
      const link = canvas.links.find((l) => l[0] === c.inputs[index].link)
      assert.deepEqual(link.slice(1, 5), [Number(value[0]), value[1], Number(id), index])
    }
  }
  assert.equal(canvas.groups.length, 8)
})

test("local plans allow outfit-only without relaxing cloud pose validation", async () => {
  const input = { provider: "gemini", costumeId: "SPR-0001", viewIds: [] }
  assert.throws(() => planRequest(input), /至少一个姿势/)
  assert.equal(planRequest({ ...input, engine: "comfyui" }).items[0].viewId, "outfit")
  assert.throws(() => planRequest({ engine: "comfyui", provider: "gemini", viewIds: [] }), /至少/)
  assert.match(localPrompts({ pose: { ...pose, people: 2 } }).final, /exactly two adult people/)
  assert.match(localPrompts({ pose, keepOutfit: false, extraPrompt: "blue coat" }).final, /may change the clothes.*blue coat/)
  await assert.rejects(buildLocalGraph({ files: file, costume: false, pose: null }), /至少/)
})

test("sheet composition preserves cell count, order, whitespace and outer aspect", async () => {
  const colors = ["red", "lime", "blue", "black"]
  const images = await Promise.all(colors.map(async (background) => ({ buffer: await sharp({ create: { width: 40, height: 40, channels: 3, background } }).png().toBuffer(), mediaType: "image/png" })))
  for (const count of [1, 2, 3, 4]) {
    const sheet = await composeLocalSheet(images.slice(0, count), "1:1")
    const { data, info } = await sharp(sheet.buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    assert.equal(info.width, info.height)
    if (count > 1) {
      const at = (x, y) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)]
      assert.deepEqual(at(Math.floor(info.width / 4), Math.floor(info.height / (count > 2 ? 4 : 2))), [255, 0, 0])
      assert.deepEqual(at(Math.floor(info.width * 3 / 4), Math.floor(info.height / (count > 2 ? 4 : 2))), [0, 255, 0])
    }
  }
})

test("local generation never uses cloud generator or needs cloud key; partial failure stays explicit", async () => {
  const image = { buffer: await sharp({ create: { width: 40, height: 40, channels: 3, background: "red" } }).png().toBuffer(), mediaType: "image/png" }
  let calls = 0
  const result = await runGeneration({ engine: "comfyui", provider: "gemini", mode: "sheet", viewIds: ["full_single_P001_front", "full_single_P002_front"] }, {
    fetchPose: async () => image,
    generate: () => { throw new Error("cloud generator was called") },
    generateLocal: async () => { if (++calls === 2) throw new Error("test failure"); return image },
  })
  assert.equal(result.results.length, 2)
  assert.equal(result.results[0].ok, true)
  assert.equal(result.results[1].ok, false)
})

test("aborting only deletes its own pending prompt, never globally interrupts", async () => {
  const image = { buffer: await sharp({ create: { width: 40, height: 40, channels: 3, background: "red" } }).png().toBuffer(), mediaType: "image/png" }
  const controller = new AbortController(), calls = []
  const { graph } = await buildLocalGraph({ files: file, costume: true })
  await assert.rejects(generateLocal({ characters: [image], garment: image, costume: true, signal: controller.signal, fetchImpl: async (url, init) => {
    const path = new URL(url).pathname
    calls.push([path, init])
    if (path === "/upload/image") return Response.json({ name: "image.png" })
    if (path === "/object_info") return Response.json(Object.fromEntries(Object.values(graph).map((n) => [n.class_type, {}])))
    if (path === "/prompt") return Response.json({ prompt_id: "our-prompt" })
    if (path === "/history/our-prompt") { controller.abort(); return Response.json({}) }
    return Response.json({})
  } }))
  assert.ok(!calls.some(([p]) => p === "/interrupt"))
  assert.deepEqual(JSON.parse(calls.find(([p]) => p === "/queue")[1].body), { delete: ["our-prompt"] })
})

test("retrying a partial sheet reuses successful cells and composes in original order", async () => {
  const image = { buffer: await sharp({ create: { width: 40, height: 40, channels: 3, background: "blue" } }).png().toBuffer(), mediaType: "image/png" }
  const input = { engine: "comfyui", provider: "gemini", mode: "sheet", localRunId: "test-retry", viewIds: ["full_single_P001_front", "full_single_P002_front"] }
  let calls = 0
  const deps = { fetchPose: async () => image, generateLocal: async () => { if (++calls === 2) throw new Error("temporary failure"); return image } }
  const first = await runGeneration(input, deps)
  assert.deepEqual(first.results.map((r) => r.ok), [true, false])
  const second = await runGeneration(input, deps)
  assert.equal(calls, 3)
  assert.equal(second.results.length, 1)
  assert.equal(second.results[0].ok, true)
})

test("cloud generation keeps its existing provider, credentials and result shape", async () => {
  const result = await runGeneration({ provider: "openai", apiKey: "test-key", viewIds: ["full_single_P001_front"] }, {
    fetchPose: async () => ({ mediaType: "image/png", buffer: Buffer.from("pose"), role: "pose" }),
    generate: async (input) => {
      assert.equal(input.provider, "openai")
      assert.equal(input.apiKey, "test-key")
      return { mediaType: "image/png", buffer: Buffer.from("result"), referencesSent: true }
    },
    generateLocal: () => { throw new Error("local generator was called") },
  })
  assert.equal(result.results[0].viewId, "full_single_P001_front")
  assert.equal(result.results[0].imageBase64, Buffer.from("result").toString("base64"))
})
