import assert from "node:assert/strict"
import { test } from "node:test"
import { pickRandomCombo } from "./random-combo.mjs"

const safePose = {
  id: "safe",
  adult: false,
  views: [
    { id: "safe-side", angle: "侧面" },
    { id: "safe-front", angle: "正面" },
  ],
}
const adultPose = {
  id: "adult-pose",
  adult: true,
  views: [{ id: "adult-front", angle: "正面" }],
}
const customPose = {
  id: "custom-pose-1",
  adult: false,
  views: [{ id: "custom-pose-1", angle: "自定义" }],
}
const coat = { id: "SPR-0001", label: "风衣", keywords: "coat", adult: false }
const lace = { id: "lace", label: "蕾丝", keywords: "lace", adult: true }

test("random combo picks one safe pose and one safe costume", () => {
  const pick = pickRandomCombo({
    poses: [adultPose, safePose],
    costumes: [lace, coat],
    showAdult: false,
    random: () => 0,
  })
  assert.equal(pick.ok, true)
  assert.equal(pick.pose.id, "safe")
  assert.equal(pick.view.id, "safe-front")
  assert.equal(pick.costume.id, "SPR-0001")
})

test("adult items stay available only when the adult filter is open", () => {
  const closed = pickRandomCombo({
    poses: [adultPose],
    costumes: [lace],
    showAdult: false,
    random: () => 0,
  })
  assert.equal(closed.ok, false)
  assert.equal(closed.message, "没有可选的姿势。")
  const opened = pickRandomCombo({
    poses: [adultPose, customPose],
    costumes: [lace, coat],
    showAdult: true,
    random: () => 0,
  })
  assert.equal(opened.pose.id, "adult-pose")
  assert.equal(opened.costume.id, "lace")
  const later = pickRandomCombo({
    poses: [adultPose, customPose],
    costumes: [lace, coat],
    showAdult: true,
    random: () => 0.99,
  })
  assert.equal(later.pose.id, "custom-pose-1")
  assert.equal(later.costume.id, "SPR-0001")
})

test("a missing costume catalog does not invent a selection", () => {
  const pick = pickRandomCombo({ poses: [safePose], costumes: [], showAdult: false })
  assert.equal(pick.ok, false)
  assert.equal(pick.costume, null)
  assert.equal(pick.message, "没有可选的服装。")
})
