import assert from "node:assert/strict"
import test from "node:test"
import { build } from "esbuild"
import sharp from "sharp"
import { createPoseHandler } from "../plugin/http.mjs"
import { apply as applyPlugin } from "../plugin/index.mjs"
import { applyEnvCredentials, serverProviderStatus } from "./credentials.mjs"
import { defaultBaseURL, defaultModel } from "./generate.mjs"
import { runProviderAction } from "./provider-settings.mjs"

const connection = { provider: "openai", baseURL: "https://gateway.example/custom/v1/", apiKey: "fixture-key" }

function cloudEnv(t, values = {}) {
  for (const name of ["POSE_MUSE_API_KEY", "POSE_MUSE_PROVIDER", "POSE_MUSE_BASE_URL", "POSE_MUSE_MODEL"]) {
    const original = process.env[name]
    if (values[name] === undefined) delete process.env[name]
    else process.env[name] = values[name]
    t.after(() => {
      if (original === undefined) delete process.env[name]
      else process.env[name] = original
    })
  }
}

test("the three directories use only their own host, authentication and response format", async t => {
  cloudEnv(t, { POSE_MUSE_PROVIDER: "openai", POSE_MUSE_API_KEY: "oa-key", POSE_MUSE_BASE_URL: connection.baseURL, POSE_MUSE_MODEL: "oa-art" })
  const roots = { openai: connection.baseURL.replace(/\/$/, ""), seedream: defaultBaseURL("seedream"), gemini: defaultBaseURL("gemini") }
  const requests = []
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const provider = Object.keys(roots).find(id => url.origin + url.pathname === roots[id] + "/models")
    assert.ok(provider)
    requests.push(provider)
    if (provider === "gemini") {
      assert.equal(init.headers["x-goog-api-key"], "google-key")
      return Response.json({ models: [{ name: "models/gemini-art" }] })
    }
    assert.equal(init.headers.authorization, provider === "seedream" ? "Bearer ark-key" : "Bearer oa-key")
    return Response.json({ data: [{ id: provider + "-art" }] })
  })
  for (const provider of ["openai", "seedream", "gemini"]) {
    const input = { provider, action: "list-models" }
    if (provider !== "openai") await assert.rejects(runProviderAction(input), /当前服务商的 API Key/)
    const apiKey = { openai: "", seedream: "ark-key", gemini: "google-key" }[provider]
    assert.deepEqual((await runProviderAction({ ...input, apiKey })).models, [{ id: provider + "-art" }])
  }
  assert.deepEqual(requests, ["openai", "seedream", "gemini"])
  assert.equal(applyEnvCredentials({ provider: "gemini" }).model, "")
  assert.equal(applyEnvCredentials({ provider: "openai", baseURL: "https://other.example/v1" }).apiKey, "")
  const gemini = { provider: "gemini", apiKey: "local-google", model: "local-model", baseURL: "https://google.example/v1beta" }
  assert.deepEqual(applyEnvCredentials({ provider: "gemini" }, gemini), gemini)
  assert.deepEqual(serverProviderStatus(gemini), { provider: "openai", keyConfigured: true, baseURL: connection.baseURL, model: "oa-art" })
})

async function browserSettings(t) {
  const compiled = await build({ entryPoints: ["lib/settings.ts"], bundle: true, platform: "browser", format: "esm", write: false })
  const settings = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`)
  const storage = new Map()
  const writes = []
  const previousWindow = globalThis.window
  globalThis.window = { localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem(key, value) { writes.push(key); storage.set(key, value) },
  } }
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow })
  return { ...settings, storage, writes }
}

test("browser provider profiles survive switching and reload without sharing keys, roots or selected models", async t => {
  const { loadSettings, saveSettings, selectCloudProvider, storage } = await browserSettings(t)
  const old = { ...connection, model: "gpt-image-2.5", textModel: "local-chat", showAdult: true }
  storage.set("lanpose-settings-v1", JSON.stringify(old))
  let settings = loadSettings()
  const server = { provider: "seedream", model: "ep-art", baseURL: "https://ark.example/api/v3", keyConfigured: true }
  for (const provider of ["seedream", "gemini"]) {
    settings = saveSettings(settings, { provider, engine: "cloud" }, server)
    assert.equal(settings.baseURL, provider === "seedream" ? server.baseURL : defaultBaseURL(provider))
    assert.equal(settings.model, provider === "seedream" ? server.model : defaultModel(provider))
    assert.equal(settings.apiKey, "")
    assert.equal(settings.textModel, "")
    settings = saveSettings(settings, { apiKey: provider + "-key", baseURL: "https://" + provider + ".example/custom", model: provider + "-image", textModel: provider + "-text" }, server)
  }
  assert.equal(loadSettings(server).provider, "gemini")
  for (const provider of ["openai", "seedream", "gemini"]) {
    const restored = saveSettings(loadSettings(server), { provider, engine: "cloud" }, server)
    assert.equal(restored.apiKey, provider === "openai" ? old.apiKey : provider + "-key")
    assert.equal(restored.baseURL, provider === "openai" ? old.baseURL : "https://" + provider + ".example/custom")
    assert.equal(restored.model, provider === "openai" ? old.model : provider + "-image")
    assert.equal(restored.textModel, provider === "openai" ? old.textModel : provider + "-text")
    assert.equal(restored.showAdult, true)
  }
  storage.clear()
  storage.set("lanpose-settings-v1", JSON.stringify({ ...old, provider: "gemini" }))
  settings = loadSettings()
  assert.equal(settings.provider, "gemini")
  assert.equal(settings.baseURL, defaultBaseURL("gemini"))
  assert.equal(settings.apiKey, "")
  saveSettings(settings, { keepOutfit: false })
  assert.equal(selectCloudProvider(settings, "openai").apiKey, old.apiKey)
  assert.equal(selectCloudProvider(settings, "openai").baseURL, old.baseURL)
})

test("stale tabs write only their edits and retain concurrent shared and per-provider changes", async t => {
  const { loadSettings, saveSettings, storage, writes } = await browserSettings(t)
  storage.set("lanpose-settings-v1", JSON.stringify({ ...connection, model: "old-art", comfyuiToken: "stale-local-token" }))
  const a = loadSettings()
  const b = loadSettings()
  saveSettings(a, { apiKey: "rotated-key", model: "new-art" })
  writes.length = 0
  saveSettings(b, { keepOutfit: false })
  assert.deepEqual(writes, ["lanpose-settings-v1:keepOutfit"])
  saveSettings(b, { textModel: "new-text" })
  saveSettings(a, { aspectRatio: "16:9" })
  const latest = loadSettings()
  assert.equal(latest.apiKey, "rotated-key")
  assert.equal(latest.model, "new-art")
  assert.equal(latest.textModel, "new-text")
  assert.equal(latest.keepOutfit, false)
  assert.equal(latest.aspectRatio, "16:9")
  assert.ok(![...storage.values()].some(value => value.includes(connection.apiKey) || value.includes("stale-local-token")))

  writes.length = 0
  const gemini = saveSettings(b, { provider: "gemini", engine: "cloud" })
  assert.deepEqual(writes, ["lanpose-settings-v1:selection"])
  saveSettings(gemini, { model: "gemini-art" })
  saveSettings(a, { apiKey: "", model: "final-art" })
  assert.equal(loadSettings().provider, "gemini")
  assert.equal(loadSettings().model, "gemini-art")
  const openai = loadSettings(null, a)
  assert.equal(openai.provider, "openai")
  assert.equal(openai.apiKey, "")
  assert.equal(openai.model, "final-art")
  assert.equal(openai.textModel, "new-text")
  assert.ok(![...storage.values()].some(value => value.includes("rotated-key")))
})

test("a quick connection check makes one authenticated directory GET, even when Gemini has more pages", async t => {
  const upstream = t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(init.method ?? "GET", "GET")
    assert.equal(init.body, undefined)
    assert.equal(init.cache, "no-store")
    assert.equal(init.redirect, "error")
    if (init.headers["x-goog-api-key"]) {
      assert.equal(init.headers["x-goog-api-key"], connection.apiKey)
      assert.equal(String(url), "https://gateway.example/custom/v1/v1beta/models?pageSize=1")
      return Response.json({ models: [{ name: "models/alias" }], nextPageToken: "never-requested" })
    }
    assert.equal(init.headers.authorization, `Bearer ${connection.apiKey}`)
    assert.equal(String(url), "https://gateway.example/custom/v1/models")
    return Response.json({ data: [] })
  })
  for (const provider of ["openai", "seedream", "gemini"]) {
    const result = await runProviderAction({ ...connection, provider, action: "test-connection" })
    assert.equal(result.connected, true)
    assert.ok(Number.isInteger(result.latencyMs) && result.latencyMs >= 0)
  }
  assert.equal(upstream.mock.callCount(), 3)
})

test("a denied, missing or malformed model directory cannot pass a quick check or trigger generation", async t => {
  const responses = [
    new Response(null, { status: 401 }), new Response(null, { status: 404 }),
    new Response("<html>gateway</html>"), Response.json({ data: [{ text: "ok" }] }),
    Response.json({ error: { message: `invalid ${connection.apiKey}` } }),
  ]
  const upstream = t.mock.method(globalThis, "fetch", async url => {
    assert.equal(new URL(url).pathname, "/custom/v1/models")
    return responses.shift()
  })
  const input = { ...connection, action: "test-connection" }
  await assert.rejects(runProviderAction(input), { status: 401 })
  await assert.rejects(runProviderAction(input), { status: 404 })
  await assert.rejects(runProviderAction(input), /模型列表格式无效/)
  await assert.rejects(runProviderAction(input), /缺少模型标识/)
  await assert.rejects(runProviderAction(input), /invalid \*\*\*/)
  assert.equal(upstream.mock.callCount(), 5)
})

test("quick checks enforce the short timeout through the upstream fetch signal", async t => {
  t.mock.method(AbortSignal, "timeout", ms => {
    assert.equal(ms, 8000)
    return AbortSignal.abort(new DOMException("Timeout", "TimeoutError"))
  })
  t.mock.method(globalThis, "fetch", async (_url, init) => init.signal.throwIfAborted())
  await assert.rejects(runProviderAction({ ...connection, action: "test-connection" }, { signal: new AbortController().signal }), /连接检测超时/)
})

test("model discovery uses the configured gateway and preserves custom IDs and declared output types", async t => {
  const upstream = t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(String(url), "https://gateway.example/custom/v1/models")
    assert.equal(init.headers.authorization, "Bearer fixture-key")
    assert.equal(init.redirect, "error")
    return Response.json({ data: [
      { id: "my-alias" }, { id: "my-alias" }, {}, { id: " " },
      { id: "paint", modalities: { output_modalities: ["image"] } },
      { id: "write", modalities: { input_modalities: ["image"], output_modalities: ["text"] } },
    ] })
  })
  for (const provider of ["openai", "seedream"]) {
    const result = await runProviderAction({ ...connection, provider, action: "list-models" })
    assert.deepEqual(result.models, [{ id: "my-alias" }, { id: "paint", outputs: ["image"] }, { id: "write", outputs: ["text"] }])
  }
  assert.equal(upstream.mock.callCount(), 2)
})

test("Gemini follows page tokens, strips resource prefixes and lists models usable by generateContent", async t => {
  const pages = []
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url.pathname, "/relay/v1beta/models")
    assert.equal(url.searchParams.get("pageSize"), "1000")
    assert.equal(init.headers["x-goog-api-key"], connection.apiKey)
    pages.push(url.searchParams.get("pageToken"))
    return pages.length === 1
      ? Response.json({ models: [{ name: "models/paint" }, { name: "models/embed", supportedGenerationMethods: ["embedContent"] }], nextPageToken: "next page" })
      : Response.json({ models: [{ name: "models/paint" }, { name: "models/write", supportedGenerationMethods: ["generateContent"] }] })
  })
  const result = await runProviderAction({ ...connection, provider: "gemini", baseURL: "https://gateway.example/relay", action: "list-models" })
  assert.deepEqual(result.models, [{ id: "paint" }, { id: "write" }])
  assert.deepEqual(pages, [null, "next page"])
})

test("tests call the selected image model, download URL results and return a decodable small preview", async t => {
  const image = await sharp({ create: { width: 160, height: 160, channels: 3, background: "blue" } }).png().toBuffer()
  const requests = []
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (String(url) === "https://images.example/result") {
      assert.equal(init.headers, undefined)
      return new Response(image, { headers: { "content-type": "image/png" } })
    }
    const body = JSON.parse(init.body)
    requests.push(new URL(url).pathname)
    assert.equal(init.method, "POST")
    if (body.contents) {
      assert.deepEqual(body.generationConfig.responseModalities, ["TEXT", "IMAGE"])
      return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: image.toString("base64") } }] } }] })
    }
    assert.equal(body.model, "chosen-model")
    assert.ok(body.prompt)
    return Response.json({ data: [{ url: "https://images.example/result" }] })
  })
  for (const provider of ["openai", "seedream", "gemini"]) {
    const result = await runProviderAction({ ...connection, provider, model: "chosen-model", action: "test-image" })
    assert.equal(result.model, "chosen-model")
    const metadata = await sharp(Buffer.from(result.previewBase64, "base64")).metadata()
    assert.equal(metadata.width, 96)
    assert.equal(metadata.format, "png")
  }
  assert.deepEqual(requests, ["/custom/v1/images/generations", "/custom/v1/images/generations", "/custom/v1/v1beta/models/chosen-model:generateContent"])
})

test("an HTTP 200 without a real image cannot pass the test and upstream errors redact credentials", async t => {
  const responses = [
    Response.json({ data: [{ b64_json: Buffer.from("this is text").toString("base64") }] }),
    Response.json({ candidates: [{ content: { parts: [{ text: `failed for ${connection.apiKey}` }] } }] }),
    Response.json({ data: [] }),
    Response.json({ error: { message: "invalid token" } }, { status: 401 }),
    Response.json({ error: { message: "missing model" } }, { status: 404 }),
  ]
  t.mock.method(globalThis, "fetch", async () => responses.shift())
  const input = { ...connection, action: "test-image" }
  await assert.rejects(runProviderAction(input), /无法解码为图片/)
  await assert.rejects(runProviderAction({ ...input, provider: "gemini" }), { message: "failed for ***" })
  await assert.rejects(runProviderAction(input), /没有返回图片/)
  await assert.rejects(runProviderAction(input), { status: 401 })
  await assert.rejects(runProviderAction(input), { status: 404 })
})

test("Harness diagnostics support plugin credentials without saving test settings or sending the key to a new root", async t => {
  cloudEnv(t)
  const upstream = t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(String(url), "https://gateway.example/custom/v1/models")
    assert.equal(init.headers.authorization, "Bearer fixture-key")
    return Response.json({ data: [] })
  })
  const handler = createPoseHandler(() => connection, { rememberStudioCredentials: () => assert.fail("diagnostic saved credentials") })
  async function post(input) {
    let status
    let payload
    await handler({
      method: "POST", url: "/dsh-pose-muse/api/provider", headers: { host: "studio.example" },
      async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(input)) },
    }, {
      writeHead(code) { status = code },
      end(body) { payload = JSON.parse(body) },
    })
    return { status, payload }
  }
  assert.deepEqual(await post({ action: "list-models" }), { status: 200, payload: { models: [] } })
  assert.equal((await post({ ...connection, action: "list-models" })).status, 200)
  const denied = await post({ action: "list-models", baseURL: "https://another.example" })
  assert.equal(denied.status, 400)
  assert.match(denied.payload.error, /服务端密钥/)
  assert.equal(upstream.mock.callCount(), 2)
})

test("Harness still uses the original provider's directory after remembering a different provider", async t => {
  cloudEnv(t, { POSE_MUSE_API_KEY: "environment-openai" })
  let handle
  const config = { ...connection, model: "oa-art" }
  applyPlugin({
    tools: { register() {} },
    inject(services, setup) {
      if (services.includes("webServer")) setup({
        effect: run => run(),
        webServer: { register(route) { handle = route.handler } },
      })
    },
  }, config)
  async function post(path, input) {
    let payload
    await handle({
      method: "POST", url: "/api/" + path, headers: { host: "studio.example" },
      async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(input)) },
    }, {
      writeHead(status) { assert.equal(status, 200) },
      end(body) { payload = JSON.parse(body) },
    })
    return payload
  }
  await post("prompt", { provider: "gemini", apiKey: "remembered-gemini", viewIds: ["full_single_P001_front"] })
  assert.equal(config.baseURL, "")
  assert.equal(config.model, "")
  const upstream = t.mock.method(globalThis, "fetch", async (url, init) => {
    if (url.hostname === "generativelanguage.googleapis.com") {
      assert.equal(init.headers["x-goog-api-key"], "remembered-gemini")
      return Response.json({ models: [{ name: "models/google-art" }] })
    }
    assert.equal(String(url), connection.baseURL + "models")
    assert.equal(init.headers.authorization, "Bearer environment-openai")
    return Response.json({ data: [{ id: "oa-art" }] })
  })
  assert.deepEqual((await post("provider", { action: "list-models", provider: "openai" })).models, [{ id: "oa-art" }])
  assert.deepEqual((await post("provider", { action: "list-models", provider: "gemini" })).models, [{ id: "google-art" }])
  assert.equal(upstream.mock.callCount(), 2)
})
