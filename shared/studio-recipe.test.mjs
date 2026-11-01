import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildRecipe,
  busyLabel,
  generateBlocked,
  libraryForRecipeChip,
  poseLimit,
  recipeAlerts,
  showHeaderRandom,
  showRecipeRandom,
  showViewResult,
} from "../shared/studio-recipe.mjs"

const pose = (id, title) => ({ id, title })

test("recipe chips, score, and library targets", () => {
  const empty = buildRecipe({ face: null, costume: null, poses: [], keepOutfit: false })
  assert.deepEqual(empty.chips.map((chip) => [chip.label, chip.removable]), [
    ["保持原脸", false],
    ["未指定服装", false],
    ["未选姿势", false],
  ])
  assert.equal(empty.score, 0)
  assert.equal(empty.scoreLabel, "配方 0/3")

  const kept = buildRecipe({ face: null, costume: null, poses: [], keepOutfit: true })
  assert.equal(kept.chips[1].label, "保持服装")
  assert.equal(kept.chips[1].removable, false)

  const full = buildRecipe({
    face: { id: "F1" },
    costume: { id: "C9" },
    poses: [pose("p1", "站立"), pose("p2", "回头"), pose("p3", "伸手"), pose("p4", "坐下"), pose("p5", "跑")],
    keepOutfit: false,
  })
  assert.equal(full.score, 3)
  assert.equal(full.scoreLabel, "配方 3/3")
  assert.deepEqual(full.chips.map((chip) => chip.label), ["脸 · F1", "服 · C9", "姿 · 站立", "姿 · 回头", "姿 · 伸手", "+2"])
  assert.equal(full.chips.at(-1).removable, false)
  assert.equal(full.chips[0].removable, true)
  assert.equal(libraryForRecipeChip(full.chips[0]), "faces")
  assert.equal(libraryForRecipeChip(full.chips[1]), "costumes")
  assert.equal(libraryForRecipeChip(full.chips[2]), "poses")
})

test("generate block matches the composer rule", () => {
  assert.equal(poseLimit("sheet"), 4)
  assert.equal(poseLimit("each"), 8)
  assert.equal(generateBlocked({ poseCount: 0, localMode: false, hasCostume: true, mode: "each" }), true)
  assert.equal(generateBlocked({ poseCount: 0, localMode: true, hasCostume: true, mode: "each" }), false)
  assert.equal(generateBlocked({ poseCount: 0, localMode: true, hasCostume: false, mode: "each" }), true)
  assert.equal(generateBlocked({ poseCount: 1, localMode: false, hasCostume: false, mode: "each" }), false)
  assert.equal(generateBlocked({ poseCount: 9, localMode: false, hasCostume: false, mode: "each" }), true)
  assert.equal(generateBlocked({ poseCount: 5, localMode: false, hasCostume: false, mode: "sheet" }), true)
})

test("busy copy, alerts, and where random / 看成图 live", () => {
  assert.equal(busyLabel(0), "正在生成 · 0s")
  assert.equal(busyLabel(12), "正在生成 · 12s")
  assert.deepEqual(recipeAlerts({ workbenchOpen: true, runError: "失败", limitNote: "太多" }), [])
  assert.deepEqual(recipeAlerts({ workbenchOpen: false, runError: "失败", limitNote: "太多" }), [
    { id: "run", status: "danger", text: "失败" },
    { id: "limit", status: "warning", text: "太多" },
  ])
  assert.deepEqual(recipeAlerts({ workbenchOpen: false, runError: "", limitNote: "" }), [])
  assert.equal(showViewResult("A", false, true), true)
  assert.equal(showViewResult("A", true, true), false)
  assert.equal(showViewResult("A", false, false), false)
  assert.equal(showViewResult("D", true, false), true)
  assert.equal(showViewResult("B", false, true), false)
  assert.equal(showViewResult("C", false, true), false)
  assert.equal(showHeaderRandom("A"), true)
  assert.equal(showHeaderRandom("B"), false)
  assert.equal(showRecipeRandom("B"), true)
  assert.equal(showRecipeRandom("D"), true)
  assert.equal(showRecipeRandom("A"), false)
  assert.equal(showRecipeRandom("C"), false)
})
