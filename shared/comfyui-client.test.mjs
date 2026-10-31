import test from "node:test"
import assert from "node:assert/strict"
import { build } from "esbuild"
import { readFile } from "node:fs/promises"
import { connectionURL, createComfyClient, checkComfyConnection, generateComfyTask, createSheetCache } from "./comfyui-client.mjs"
import { buildLocalGraph } from "./comfyui.mjs"
import { createPoseHandler } from "../plugin/http.mjs"

test("connection URLs allow HTTPS proxy prefixes and HTTP loopback only", () => {
  assert.equal(connectionURL(), "http://127.0.0.1:8188")
  assert.equal(connectionURL(" https://comfy.example.com/comfy/ "), "https://comfy.example.com/comfy")
  assert.equal(connectionURL("http://[::1]:8188/"), "http://[::1]:8188")
  for (const url of ["http://192.168.1.2:8188", "http://127.0.0.1.evil.example", "https://user:secret@comfy.example", "https://comfy.example/?key=secret", "https://comfy.example/#secret", "file:///tmp/image", "bad"]) assert.throws(() => connectionURL(url))
})

test("credentials only reach explicit endpoint routes, never redirects or cookies", async () => {
  const calls = []
  const client = createComfyClient({ url: "https://comfy.example/comfy", token: "private-token", fetchImpl: async (url, init) => { calls.push({ url, init }); return Response.json({}) } })
  await client.request("/system_stats")
  assert.equal(calls[0].url, "https://comfy.example/comfy/system_stats")
  assert.equal(calls[0].init.headers.get("authorization"), "Bearer private-token")
  assert.equal(calls[0].init.redirect, "error")
  assert.equal(calls[0].init.credentials, "omit")
  assert.equal(calls[0].init.referrerPolicy, "no-referrer")
  for (const path of ["//evil.example/system_stats", "/../system_stats", "/interrupt", "/userdata", "/view/../../evil"]) await assert.rejects(client.request(path), /不支持/)
  assert.equal(calls.length, 1)
  assert.throws(() => createComfyClient({ url: "https://comfy.example", token: "bad\r\ntoken" }), /令牌格式/)
  const rejected = createComfyClient({ url: "https://comfy.example", fetchImpl: async () => new Response("denied", { status: 401 }) })
  await assert.rejects(rejected.request("/prompt"), /401.*令牌/)
  const error = createComfyClient({ url: "https://comfy.example", token: " private-token ", fetchImpl: async () => new Response("x".repeat(1195) + "private-token", { status: 500 }) })
  await assert.rejects(error.request("/prompt"), (e) => !e.message.includes("private-token"))
  await assert.rejects(error.request("/prompt"), (e) => !e.message.includes("priva"))
})

test("connection checks validate service info and propagate timeout/abort", async () => {
  const options = { url: "http://localhost:8188", fetchImpl: async () => Response.json({ system: {}, devices: [] }) }
  assert.equal((await checkComfyConnection(options)).available, true)
  await assert.rejects(checkComfyConnection({ ...options, fetchImpl: async () => Response.json({ wrong: true }) }), /有效/)
  const controller = new AbortController()
  controller.abort(new DOMException("Timed out", "TimeoutError"))
  await assert.rejects(checkComfyConnection({ ...options, signal: controller.signal, fetchImpl: async (_url, init) => { init.signal.throwIfAborted() } }), { name: "TimeoutError" })
})

async function fixture(overrides = {}) {
  const options = { url: "https://comfy.example/prefix", token: "test-token", characters: [new Blob(["person"])], garment: new Blob(["garment"]), costume: true }
  const { graph, output } = await buildLocalGraph({ files: { characters: ["person.png"], garment: "garment.png" }, costume: true })
  const calls = []
  const fetchImpl = async (url, init) => {
    const path = new URL(url).pathname.replace("/prefix", "")
    calls.push([path, init])
    assert.equal(init.headers.get("authorization"), "Bearer test-token")
    if (overrides[path]) return overrides[path](init)
    if (path === "/object_info") return Response.json(Object.fromEntries(Object.values(graph).map((n) => [n.class_type, {}])))
    if (path === "/upload/image") return Response.json({ name: "image.png" })
    if (path === "/prompt") return Response.json({ prompt_id: "our-prompt" })
    if (path === "/history/our-prompt") return Response.json({ "our-prompt": { status: { status_str: "success" }, outputs: { [output]: { images: [{ filename: "result.png", type: "output" }] } } } })
    if (path === "/view") return new Response(new Blob(["result"], { type: "image/png" }))
    return Response.json({})
  }
  return { options: { ...options, fetchImpl }, calls }
}

test("browser task follows preflight, upload, queue, history and output using one endpoint", async () => {
  const { options, calls } = await fixture()
  assert.equal(await (await generateComfyTask(options)).text(), "result")
  assert.deepEqual(calls.map(([p]) => p), ["/object_info", "/upload/image", "/upload/image", "/prompt", "/history/our-prompt", "/view"])
  assert.equal(calls.find(([p]) => p === "/upload/image")[1].body.get("type"), "input")
})

test("browser uploads an upstream face reference and preserves the graph's face slot", async () => {
  let submission
  const { graph } = await buildLocalGraph({ files: { characters: ["one.png", "two.png"], garment: "garment.png", pose: "pose.png", face: "face.png" }, costume: true, pose: { name: "站立", angle: "正面", category: "站姿", people: 1 }, face: { id: "face-test" } })
  const { options, calls } = await fixture({ "/object_info": () => Response.json(Object.fromEntries(Object.values(graph).map((n) => [n.class_type, {}]))), "/prompt": (init) => {
    submission = JSON.parse(init.body)
    return Response.json({ prompt_id: "our-prompt" })
  } })
  await generateComfyTask({ ...options, characters: [new Blob(["one"]), new Blob(["two"])], poseImage: new Blob(["pose"]), pose: { name: "站立", angle: "正面", category: "站姿", people: 1 }, faceImage: new Blob(["face"]), face: { id: "face-test" } })
  assert.equal(calls.filter(([path]) => path === "/upload/image").length, 5)
  assert.equal(submission.prompt["510"].inputs.image, "image.png")
  assert.equal(submission.prompt["207"].inputs["images.image_6"][0], "510")
  assert.match(submission.prompt["207"].inputs.prompt, /<image6> as the only face/)
})

test("missing dependencies and unsafe image paths fail before queue submission", async () => {
  const missing = await fixture({ "/object_info": () => Response.json({}) })
  await assert.rejects(generateComfyTask(missing.options), /缺少 ComfyUI 节点/)
  assert.deepEqual(missing.calls.map(([p]) => p), ["/object_info"])
  const unsafe = await fixture({ "/upload/image": () => Response.json({ name: "image.png", subfolder: "../outside" }) })
  await assert.rejects(generateComfyTask(unsafe.options), /路径无效/)
  assert.ok(!unsafe.calls.some(([p]) => p === "/prompt"))
  const failed = await fixture({ "/history/our-prompt": () => Response.json({ "our-prompt": { status: { status_str: "error" } } }) })
  await assert.rejects(generateComfyTask(failed.options), /执行失败/)
})

test("cancellation and timeout only delete this task, never globally interrupt", async () => {
  for (const reason of [new DOMException("Stopped", "AbortError"), new DOMException("Timeout", "TimeoutError")]) {
    const controller = new AbortController()
    const { options, calls } = await fixture({ "/history/our-prompt": () => { controller.abort(reason); return Response.json({}) } })
    await assert.rejects(generateComfyTask({ ...options, signal: controller.signal }), { name: reason.name })
    assert.ok(!calls.some(([p]) => p === "/interrupt"))
    const cleanup = calls.find(([p]) => p === "/queue")[1]
    assert.deepEqual(JSON.parse(cleanup.body), { delete: ["our-prompt"] })
    assert.equal(cleanup.signal.aborted, false)
  }
})

test("retry cells retain successes, are bounded and expire; changed input uses a new key", () => {
  let time = 0
  const cache = createSheetCache({ now: () => time })
  const first = cache.cells("input-1")
  first.set("pose-1", new Blob(["success"]))
  assert.equal(cache.cells("input-1").get("pose-1"), first.get("pose-1"))
  assert.equal(cache.cells("changed-input").size, 0)
  for (let i = 0; i < 4; i++) cache.cells(`next-${i}`)
  assert.equal(cache.cells("input-1").size, 0)
  cache.cells("expiring").set("pose", new Blob())
  time = 600000
  assert.equal(cache.cells("expiring").size, 0)
  cache.cells("completed").set("pose", new Blob())
  cache.delete("completed")
  assert.equal(cache.cells("completed").size, 0)
})

test("settings migrate old ComfyUI selection and never persist or restore its token", async () => {
  const compiled = await build({ entryPoints: ["lib/settings.ts"], bundle: true, platform: "browser", format: "esm", write: false })
  const settings = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`)
  let stored = JSON.stringify({ engine: "comfyui", apiKey: "old-cloud-key", comfyuiToken: "stale-token" })
  globalThis.window = { localStorage: { getItem: () => stored, setItem: (_key, value) => { stored = value } } }
  try {
    const migrated = settings.loadSettings()
    assert.equal(migrated.engine, "comfyui")
    assert.equal(migrated.comfyuiURL, "http://127.0.0.1:8188")
    assert.equal(migrated.apiKey, "old-cloud-key")
    assert.equal(migrated.comfyuiToken, "")
    settings.saveSettings({ ...migrated, comfyuiToken: "new-secret", comfyuiURL: "https://comfy.example/prefix" })
    assert.ok(!stored.includes("new-secret"))
    assert.equal(settings.loadSettings().comfyuiURL, "https://comfy.example/prefix")
  } finally { delete globalThis.window }
})

test("Harness refuses legacy ComfyUI execution without entering cloud generation", async () => {
  let status, body
  const handler = createPoseHandler(() => ({ apiKey: "cloud-key" }))
  const req = { method: "POST", url: "/api/generate", headers: { host: "localhost" }, async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ engine: "comfyui" })) } }
  await handler(req, { writeHead: (code) => { status = code }, end: (data) => { body = JSON.parse(data) } })
  assert.equal(status, 400)
  assert.match(body.error, /不再支持服务端/)
  const source = await readFile(new URL("../app/api/generate/route.ts", import.meta.url), "utf8")
  assert.ok(source.indexOf('body.engine === "comfyui"') < source.indexOf("process.env.POSE_MUSE_API_KEY"))
})
