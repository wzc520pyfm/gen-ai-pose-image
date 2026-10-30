import assert from "node:assert/strict"
import { test } from "node:test"
import { CHARACTER_SHEET_PROMPT, LAYOUT_SHEET_FILE, generateCharacterSheet } from "./character-sheet.mjs"
import {
  activateModel,
  adoptCurrent,
  deleteFromLibrary,
  identityImage,
  renameModel,
  syncLibrary,
  withGeneratedSheet,
  withUploadedSheet,
} from "./models.mjs"

function pngBuffer() {
  const bytes = Buffer.alloc(64, 0)
  bytes[0] = 0x89
  bytes[1] = 0x50
  bytes[2] = 0x4e
  bytes[3] = 0x47
  return bytes
}

const photo = { id: "photo-1", mediaType: "image/jpeg", dataBase64: "cGhvdG8=", role: "photo" }
const photoTwo = { id: "photo-2", mediaType: "image/jpeg", dataBase64: "cGhvdG8y", role: "photo" }
const sheet = { id: "sheet-1", mediaType: "image/jpeg", dataBase64: "c2hlZXQ=", role: "sheet" }

test("character sheet prompt keeps the imported person and only borrows layout", () => {
  assert.match(CHARACTER_SHEET_PROMPT, /同一个人/)
  assert.match(CHARACTER_SHEET_PROMPT, /第一张/)
  assert.match(CHARACTER_SHEET_PROMPT, /第二张/)
  assert.match(CHARACTER_SHEET_PROMPT, /不要画成大肥鱼/)
  assert.match(CHARACTER_SHEET_PROMPT, /成人比例/)
  assert.match(LAYOUT_SHEET_FILE, /public\/muse\/dafeiyu-sheet\.png$/)
})

test("character sheet generation sends the user photo and the layout sheet", async () => {
  let generated = null
  const result = await generateCharacterSheet({
    provider: "gemini",
    apiKey: "test-key",
    image: { mediaType: "image/png", dataBase64: pngBuffer().toString("base64") },
    readFile: async () => pngBuffer(),
    generate: async (input) => {
      generated = input
      return { mediaType: "image/png", buffer: pngBuffer(), referencesSent: true }
    },
  })
  assert.equal(result.referencesSent, true)
  assert.equal(generated.images.length, 2)
  assert.deepEqual(generated.images.map((image) => image.role), ["identity", "layout"])
  assert.equal(generated.prompt, CHARACTER_SHEET_PROMPT)
  assert.equal(generated.aspectRatio, "16:9")
})

test("a missing layout sheet does not fall back to text-only generation", async () => {
  let generated = false
  await assert.rejects(() => generateCharacterSheet({
    provider: "gemini",
    apiKey: "test-key",
    image: { mediaType: "image/png", dataBase64: pngBuffer().toString("base64") },
    readFile: async () => {
      throw new Error("ENOENT")
    },
    generate: async () => {
      generated = true
      return { mediaType: "image/png", buffer: pngBuffer() }
    },
  }), /多视角排版参考没有读到/)
  await assert.rejects(() => generateCharacterSheet({
    provider: "gemini",
    apiKey: "test-key",
    image: {},
    generate: async () => {
      generated = true
    },
  }), /先导入一张模特照片/)
  assert.equal(generated, false)
})

test("a generated sheet stays first and the original photos stay", () => {
  const first = withGeneratedSheet([photo, photoTwo], sheet)
  assert.deepEqual(first.map((image) => image.id), ["sheet-1", "photo-1", "photo-2"])
  assert.equal(first[0].role, "sheet")
  assert.equal(identityImage(first).id, "photo-1")
  const again = withGeneratedSheet(first, { id: "sheet-2", dataBase64: "bmV3", role: "sheet" })
  assert.deepEqual(again.map((image) => image.id), ["sheet-2", "photo-1", "photo-2"])
  const uploaded = withUploadedSheet([photo], sheet)
  assert.deepEqual(uploaded.map((image) => [image.id, image.role]), [["sheet-1", "sheet"], ["photo-1", "photo"]])
  const sheetOnly = withUploadedSheet([], sheet)
  assert.deepEqual(sheetOnly.map((image) => image.role), ["sheet"])
  assert.equal(identityImage(sheetOnly).id, "sheet-1")
})

test("library save, switch, rename, and delete keep the selected model", () => {
  const created = syncLibrary([], null, [photo], 10, () => "aaa")
  assert.equal(created.activeId, "model-aaa")
  assert.equal(created.entry.label, "模特 1")
  assert.equal(created.entry.images[0].id, "photo-1")
  const updated = syncLibrary(created.models, created.activeId, [photo, photoTwo], 20)
  assert.equal(updated.models.length, 1)
  assert.equal(updated.entry.images.length, 2)
  assert.equal(updated.entry.label, "模特 1")
  const second = syncLibrary(updated.models, null, [photoTwo], 30, () => "bbb")
  assert.equal(second.models.length, 2)
  assert.equal(activateModel(second.models, "model-aaa").images.length, 2)
  const renamed = renameModel(second.models, "model-aaa", " 小蓝 ")
  assert.equal(renamed.find((model) => model.id === "model-aaa").label, "小蓝")
  const removed = deleteFromLibrary(renamed, "model-aaa", "model-aaa")
  assert.equal(removed.cleared, true)
  assert.equal(removed.activeId, null)
  assert.equal(removed.models.length, 1)
  const wiped = syncLibrary(updated.models, updated.activeId, [], 40)
  assert.equal(wiped.models.length, 0)
  assert.equal(wiped.removedId, "model-aaa")
  const adopted = adoptCurrent([], [photo], null, 50, () => "old")
  assert.equal(adopted.adopted, true)
  assert.equal(adopted.activeId, "model-old")
  const kept = adoptCurrent(adopted.models, [photo], adopted.activeId, 60)
  assert.equal(kept.adopted, false)
  assert.equal(kept.models.length, 1)
})
