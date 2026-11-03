import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"
import { createPoseHandler } from "./http.mjs"
import { dropUndefined, plainAttachment } from "./index.mjs"

test("dropUndefined strips undefined object fields for lossless JSON", () => {
  const value = dropUndefined({
    ok: true,
    warning: undefined,
    nested: { a: 1, b: undefined },
    list: [1, { c: undefined, d: "x" }],
  })
  assert.deepEqual(value, { ok: true, nested: { a: 1 }, list: [1, { d: "x" }] })
  const roundTrip = JSON.parse(JSON.stringify(value))
  assert.deepEqual(roundTrip, value)
})

test("plainAttachment keeps only JSON-safe scalar fields", () => {
  const attachment = {
    id: "att-1",
    path: "/tmp/a.png",
    name: "pose",
    mediaType: "image/png",
    save: () => {},
    meta: { nested: true },
    bytes: 12,
    flag: true,
    empty: undefined,
  }
  assert.deepEqual(plainAttachment(attachment), {
    id: "att-1",
    path: "/tmp/a.png",
    name: "pose",
    mediaType: "image/png",
    bytes: 12,
    flag: true,
  })
  assert.equal(plainAttachment(null), undefined)
})

test("studio generate body remembers apiKey for later tool config reads", async () => {
  const remembered = []
  const config = { apiKey: "", provider: "gemini" }
  const getConfig = () => ({ ...config })
  const handler = createPoseHandler(getConfig, {
    rememberStudioCredentials(body) {
      remembered.push({ apiKey: body.apiKey, provider: body.provider })
      config.apiKey = String(body.apiKey).trim()
      if (body.provider) config.provider = body.provider
    },
  })

  let status
  const req = {
    method: "POST",
    url: "/api/prompt",
    headers: { host: "localhost" },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify({
        apiKey: "studio-secret-key",
        provider: "seedream",
        viewIds: ["full_single_P001_front"],
      }))
    },
  }
  await handler(req, {
    writeHead: (code) => { status = code },
    end: () => {},
  })
  assert.equal(status, 200)
  assert.equal(remembered.length, 1)
  assert.equal(remembered[0].apiKey, "studio-secret-key")
  assert.equal(config.apiKey, "studio-secret-key")
  assert.equal(getConfig().apiKey, "studio-secret-key")
})

test("persistImage reads attachments via ctx.get and inject stays tools-only", async () => {
  const source = await readFile(new URL("./index.mjs", import.meta.url), "utf8")
  assert.match(source, /export const inject = \["tools"\]/)
  assert.match(source, /typeof ctx\.get === "function" \? ctx\.get\("attachments"\)/)
  assert.doesNotMatch(source, /ctx\.attachments &&/)
  assert.match(source, /rememberStudioCredentials/)
  assert.match(source, /dropUndefined\(/)
})
