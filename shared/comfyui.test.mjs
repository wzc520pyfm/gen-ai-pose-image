import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { activeGraph, buildLocalGraph, dimensions, localPrompts } from "./comfyui.mjs"
import { planRequest, runGeneration } from "./jobs.mjs"

const file = { characters: ["person.png"], garment: "clothes.png", pose: "pose.png" }
const pose = { name: "双手抬起", angle: "正面", category: "站姿", people: 1 }

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

test("legacy server execution is rejected before any cloud call or reference loading", async () => {
  const input = { engine: "comfyui", provider: "gemini", apiKey: "cloud-key", costumeId: "SPR-0001", viewIds: [] }
  assert.throws(() => planRequest(input), /不再支持服务端/)
  await assert.rejects(runGeneration(input, { generate: () => { throw new Error("cloud generator was called") } }), /不再支持服务端/)
  assert.match(localPrompts({ pose: { ...pose, people: 2 } }).final, /exactly two adult people/)
  assert.match(localPrompts({ pose, keepOutfit: false, extraPrompt: "blue coat" }).final, /may change the clothes.*blue coat/)
  await assert.rejects(buildLocalGraph({ files: file, costume: false, pose: null }), /至少/)
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
