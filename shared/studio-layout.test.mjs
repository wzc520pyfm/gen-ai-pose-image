import assert from "node:assert/strict"
import { test } from "node:test"
import { STUDIO_LAYOUT_KEY, retireStudioLayout } from "../shared/studio-layout.mjs"

test("retireStudioLayout removes the obsolete A-D preference", () => {
  const memory = new Map()
  const storage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => { memory.set(key, String(value)) },
    removeItem: (key) => { memory.delete(key) },
  }
  storage.setItem(STUDIO_LAYOUT_KEY, "A")
  retireStudioLayout(storage)
  assert.equal(storage.getItem(STUDIO_LAYOUT_KEY), null)
  retireStudioLayout(storage)
  assert.equal(storage.getItem(STUDIO_LAYOUT_KEY), null)
  retireStudioLayout(null)
})
