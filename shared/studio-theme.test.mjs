import assert from "node:assert/strict"
import { test } from "node:test"
import {
  STUDIO_THEME_KEY,
  applyStudioTheme,
  loadStudioTheme,
  normalizeStudioTheme,
  resolveStudioTheme,
  saveStudioTheme,
} from "../shared/studio-theme.mjs"

test("theme preference accepts light, dark, and system", () => {
  assert.equal(normalizeStudioTheme("light"), "light")
  assert.equal(normalizeStudioTheme("dark"), "dark")
  assert.equal(normalizeStudioTheme("system"), "system")
  assert.equal(normalizeStudioTheme("A"), "system")
  assert.equal(normalizeStudioTheme(null), "system")
})

test("load and save round-trip the theme key only", () => {
  const memory = new Map()
  const storage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => { memory.set(key, String(value)) },
    removeItem: (key) => { memory.delete(key) },
  }
  assert.equal(loadStudioTheme(storage), "system")
  saveStudioTheme("dark", storage)
  assert.equal(storage.getItem(STUDIO_THEME_KEY), "dark")
  assert.equal(loadStudioTheme(storage), "dark")
  saveStudioTheme("nope", storage)
  assert.equal(storage.getItem(STUDIO_THEME_KEY), "system")
})

test("system preference follows the OS and an explicit choice wins", () => {
  assert.equal(resolveStudioTheme("system", true), "dark")
  assert.equal(resolveStudioTheme("system", false), "light")
  assert.equal(resolveStudioTheme("light", true), "light")
  assert.equal(resolveStudioTheme("dark", false), "dark")
})

test("applyStudioTheme sets class, data-theme, and color-scheme", () => {
  const element = {
    className: new Set(),
    dataset: {},
    style: {},
  }
  element.classList = {
    toggle(name, on) {
      if (on) element.className.add(name)
      else element.className.delete(name)
    },
  }
  applyStudioTheme(element, "dark")
  assert.equal(element.className.has("dark"), true)
  assert.equal(element.className.has("light"), false)
  assert.equal(element.dataset.theme, "dark")
  assert.equal(element.style.colorScheme, "dark")
  applyStudioTheme(element, "light")
  assert.equal(element.className.has("dark"), false)
  assert.equal(element.className.has("light"), true)
  assert.equal(element.dataset.theme, "light")
  assert.equal(element.style.colorScheme, "light")
})
