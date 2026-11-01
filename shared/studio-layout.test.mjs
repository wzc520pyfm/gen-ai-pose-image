import assert from "node:assert/strict"
import { test } from "node:test"
import {
  DEFAULT_STUDIO_LAYOUT,
  STUDIO_LAYOUT_KEY,
  loadStudioLayout,
  normalizeStudioLayout,
  saveStudioLayout,
} from "../shared/studio-layout.mjs"

test("normalizeStudioLayout accepts A-D and defaults otherwise", () => {
  assert.equal(normalizeStudioLayout("A"), "A")
  assert.equal(normalizeStudioLayout("B"), "B")
  assert.equal(normalizeStudioLayout("C"), "C")
  assert.equal(normalizeStudioLayout("D"), "D")
  assert.equal(normalizeStudioLayout("Z"), DEFAULT_STUDIO_LAYOUT)
  assert.equal(normalizeStudioLayout(null), DEFAULT_STUDIO_LAYOUT)
  assert.equal(normalizeStudioLayout(""), DEFAULT_STUDIO_LAYOUT)
})

test("loadStudioLayout reads storage and falls back to C", () => {
  const memory = new Map()
  const storage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => { memory.set(key, String(value)) },
    removeItem: (key) => { memory.delete(key) },
  }
  assert.equal(loadStudioLayout(storage), "C")
  storage.setItem(STUDIO_LAYOUT_KEY, "B")
  assert.equal(loadStudioLayout(storage), "B")
  storage.setItem(STUDIO_LAYOUT_KEY, "nope")
  assert.equal(loadStudioLayout(storage), "C")
})

test("saveStudioLayout writes only normalized ids", () => {
  const memory = new Map()
  const storage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => { memory.set(key, String(value)) },
    removeItem: (key) => { memory.delete(key) },
  }
  saveStudioLayout("D", storage)
  assert.equal(storage.getItem(STUDIO_LAYOUT_KEY), "D")
})
