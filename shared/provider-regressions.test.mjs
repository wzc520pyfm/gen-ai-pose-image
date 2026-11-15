import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test from "node:test"
import { pathToFileURL } from "node:url"
import { build } from "esbuild"
import sharp from "sharp"
import { apply } from "../plugin/index.mjs"
import { runProviderAction } from "./provider-settings.mjs"

const require = createRequire(import.meta.url)
const root = "https://provider.example/v1"
const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: "blue" } }).png().toBuffer()

function cloudEnv(t, values = {}) {
  for (const name of ["POSE_MUSE_PROVIDER", "POSE_MUSE_API_KEY", "POSE_MUSE_BASE_URL", "POSE_MUSE_MODEL", "POSE_MUSE_DOCKER_HOST"]) {
    const original = process.env[name]
    if (values[name] === undefined) delete process.env[name]
    else process.env[name] = values[name]
    t.after(() => {
      if (original === undefined) delete process.env[name]
      else process.env[name] = original
    })
  }
}

async function loadRoute(name) {
  const compiled = await build({
    entryPoints: [`app/api/${name}/route.ts`], bundle: true, platform: "node", format: "esm", write: false,
    plugins: [{
      name: "external-route-dependencies",
      setup(builder) {
        builder.onResolve({ filter: /^(?:@\/|next\/server$)/ }, ({ path }) => ({
          path: path.startsWith("@/") ? new URL(`../${path.slice(2)}`, import.meta.url).href : pathToFileURL(require.resolve(path)).href,
          external: true,
        }))
      },
    }],
  })
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`)
}

function imageService(t) {
  const calls = []
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (String(url).startsWith("https://ai-pose-gallery.anhao.app/")) return new Response(image)
    const target = new URL(url)
    assert.ok(["provider.example", "configured.example", "ark.example"].includes(target.hostname), `unexpected upstream: ${url}`)
    const model = init.body instanceof FormData ? init.body.get("model") : JSON.parse(init.body).model
    calls.push({ url: String(url), key: init.headers.authorization, model })
    return Response.json({ data: [{ b64_json: image.toString("base64") }] })
  })
  return calls
}

for (const route of ["provider", "generate"]) {
  test(`${route} rejects non-JSON media types before using server credentials`, async t => {
    cloudEnv(t, { POSE_MUSE_PROVIDER: "openai", POSE_MUSE_API_KEY: "server-key", POSE_MUSE_BASE_URL: root })
    const { POST } = await loadRoute(route)
    const calls = imageService(t)
    const body = JSON.stringify({ action: "test-image", provider: "openai", viewIds: ["full_single_P001_front"] })
    for (const type of [null, "text/plain", "text/plain; x=application/json", "application/x-www-form-urlencoded", "multipart/form-data; boundary=application/json", "application/jsonp"]) {
      const request = new Request(`https://studio.example/api/${route}`, { method: "POST", body })
      if (type === null) request.headers.delete("content-type")
      else request.headers.set("content-type", type)
      const response = await POST(request)
      assert.equal(response.status, 415, `accepted ${type}`)
    }
    assert.deepEqual(calls, [])
  })

  test(`${route} accepts JSON with parameters and case differences and still validates the body`, async t => {
    cloudEnv(t, { POSE_MUSE_PROVIDER: "openai", POSE_MUSE_API_KEY: "server-key", POSE_MUSE_BASE_URL: root, POSE_MUSE_MODEL: "test-image-model" })
    const { POST } = await loadRoute(route)
    const calls = imageService(t)
    for (const type of ["application/json", " Application/JSON ; charset=utf-8 "]) {
      const response = await POST(new Request(`https://studio.example/api/${route}`, {
        method: "POST", headers: { "content-type": type },
        body: JSON.stringify({ action: "test-image", provider: "openai", viewIds: ["full_single_P001_front"] }),
      }))
      assert.equal(response.status, 200)
      const payload = await response.json()
      if (route === "provider") assert.ok(payload.previewBase64)
      else assert.equal(payload.results[0].ok, true, payload.results[0].error)
    }
    assert.equal(calls.length, 2)
    const invalid = await POST(new Request(`https://studio.example/api/${route}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{",
    }))
    assert.equal(invalid.status, 400)
    assert.equal(calls.length, 2)
  })
}

test("saving a new ComfyUI URL drops the old token but permits an explicitly supplied replacement", async t => {
  const compiled = await build({ entryPoints: ["lib/settings.ts"], bundle: true, platform: "browser", format: "esm", write: false })
  const { loadSettings, saveSettings } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`)
  const storage = new Map()
  const previousWindow = globalThis.window
  globalThis.window = { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } }
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow })
  const current = saveSettings(loadSettings(), { comfyuiURL: "https://comfy-a.example", comfyuiToken: "token-a" })
  const changed = saveSettings(current, { comfyuiURL: "https://comfy-b.example" })
  assert.equal(changed.comfyuiToken, "")
  assert.equal(loadSettings(null, changed).comfyuiToken, "")
  assert.equal(saveSettings(current, { comfyuiURL: current.comfyuiURL }).comfyuiToken, "token-a")
  assert.equal(saveSettings(current, { keepOutfit: false }).comfyuiToken, "token-a")
  const replacement = saveSettings(current, { comfyuiURL: "https://comfy-b.example", comfyuiToken: "token-b" })
  assert.equal(replacement.comfyuiToken, "token-b")
  assert.equal(loadSettings(null, replacement).comfyuiToken, "token-b")
  assert.equal(loadSettings().comfyuiToken, "")
  assert.ok(![...storage.values()].some(value => /token-[ab]/.test(value)))
})

function harness(config = {}) {
  let generate, handler
  apply({
    tools: { register(tool) { if (tool.name === "generate_pose_images") generate = tool } },
    get: name => name === "attachments" ? { saveImage: async () => ({ id: "fixture-attachment" }) } : undefined,
    inject(services, setup) {
      if (services.includes("webServer")) setup({ effect: run => run(), webServer: { register(route) { handler = route.handler } } })
    },
  }, config)
  return { generate, handler }
}

async function remember(handler, profile) {
  await handler({
    method: "POST", url: "/api/prompt", headers: { host: "studio.example" },
    async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ ...profile, viewIds: ["full_single_P001_front"] })) },
  }, { writeHead: status => assert.equal(status, 200), end() {} })
}

for (const provider of ["openai", "seedream"]) {
  test(`Harness generates with the environment's ${provider} default when provider is omitted`, async t => {
    cloudEnv(t, { POSE_MUSE_PROVIDER: provider, POSE_MUSE_API_KEY: "env-key", POSE_MUSE_BASE_URL: root, POSE_MUSE_MODEL: "env-model" })
    const calls = imageService(t)
    const { generate } = harness()
    const result = await generate.execute({ view_ids: ["full_single_P001_front"] })
    assert.equal(result.generated, true)
    assert.equal(result.images[0].ok, true, result.images[0].error)
    assert.deepEqual(calls, [{ url: root + (provider === "openai" ? "/images/edits" : "/images/generations"), key: "Bearer env-key", model: "env-model" }])
  })
}

test("Harness preserves explicit provider overrides and the configured default without an environment override", async t => {
  cloudEnv(t)
  const calls = imageService(t)
  const { generate } = harness({ provider: "seedream", apiKey: "config-key", baseURL: "https://ark.example/api/v3", model: "config-model" })
  let result = await generate.execute({ view_ids: ["full_single_P001_front"] })
  assert.equal(result.images[0].ok, true, result.images[0].error)
  process.env.POSE_MUSE_PROVIDER = "openai"
  process.env.POSE_MUSE_API_KEY = "env-key"
  process.env.POSE_MUSE_BASE_URL = root
  result = await generate.execute({ provider: "seedream", model: "explicit-model", view_ids: ["full_single_P001_front"] })
  assert.equal(result.images[0].ok, true, result.images[0].error)
  assert.deepEqual(calls.map(({ key, model }) => ({ key, model })), [
    { key: "Bearer config-key", model: "config-model" }, { key: "Bearer config-key", model: "explicit-model" },
  ])
  const unconfigured = await generate.execute({ provider: "gemini", view_ids: ["full_single_P001_front"] })
  assert.equal(unconfigured.generated, false)
  assert.equal(calls.length, 2)
})

test("Harness selects the effective provider's remembered profile before resolving credentials", async t => {
  cloudEnv(t, { POSE_MUSE_PROVIDER: "openai" })
  const calls = imageService(t)
  const { generate, handler } = harness()
  await remember(handler, { provider: "openai", apiKey: "profile-key", baseURL: "https://configured.example/v1", model: "profile-model" })
  await remember(handler, { provider: "gemini", apiKey: "google-key" })
  const result = await generate.execute({ view_ids: ["full_single_P001_front"] })
  assert.equal(result.generated, true)
  assert.equal(result.images[0].ok, true, result.images[0].error)
  assert.deepEqual(calls, [{ url: "https://configured.example/v1/images/edits", key: "Bearer profile-key", model: "profile-model" }])
})

for (const action of ["test-connection", "list-models"]) {
  test(`${action} reports timeouts while reading an HTTP 200 body`, async t => {
    cloudEnv(t)
    t.mock.method(globalThis, "fetch", async () => new Response(new ReadableStream({
      start(controller) { controller.error(new DOMException("body timed out", "TimeoutError")) },
    })))
    await assert.rejects(runProviderAction({ action, provider: "openai", apiKey: "test-key", baseURL: root }),
      action === "test-connection" ? /连接检测超时/ : /获取模型列表超时/)
  })
}

test("model directories distinguish malformed JSON from cancellation and network body errors", async t => {
  cloudEnv(t)
  const input = { action: "list-models", provider: "openai", apiKey: "test-key", baseURL: root }
  let error
  t.mock.method(globalThis, "fetch", async () => error ? new Response(new ReadableStream({
    start(controller) { controller.error(error) },
  })) : new Response("not JSON"))
  await assert.rejects(runProviderAction(input), /模型列表格式无效/)
  error = new DOMException("cancelled by user", "AbortError")
  await assert.rejects(runProviderAction(input), /cancelled by user/)
  error = new TypeError("body interrupted for test-key")
  await assert.rejects(runProviderAction(input), /body interrupted for \*\*\*/)
})
