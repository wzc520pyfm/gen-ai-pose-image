import assert from "node:assert/strict"
import { test } from "node:test"
import {
  createChromeBook,
  emptyChrome,
  isStudioWide,
  libraryHeading,
  previewDrawerPlacement,
  reduceChrome,
  showHeaderLibraryTabs,
  showHeaderSettings,
  showMobileWorkOrder,
  workbenchPlacement,
} from "../shared/studio-chrome.mjs"

test("chrome starts closed and layout flags stay isolated", () => {
  const book = createChromeBook()
  assert.deepEqual(book.A, emptyChrome())
  assert.equal(book.B.modelStripOpen, false)
  const next = reduceChrome(book, "A", { type: "open-workbench", wide: true })
  assert.equal(next.A.workbenchOpen, true)
  assert.equal(next.B.workbenchOpen, false)
  assert.equal(book.A.workbenchOpen, false)
  const again = reduceChrome(next, "A", { type: "dismiss-preview" })
  assert.equal(again.A.workbenchOpen, true)
})

test("prime remembers a result without opening, and a newer success opens A and D", () => {
  let book = createChromeBook()
  book = reduceChrome(book, "A", { type: "prime", resultKey: "old" })
  assert.equal(book.A.previewOpen, false)
  assert.equal(book.A.seenResultKey, "old")
  book = reduceChrome(book, "A", { type: "success", resultKey: "old" })
  assert.equal(book.A.previewOpen, false)
  book = reduceChrome(book, "A", { type: "success", resultKey: "new" })
  assert.equal(book.A.previewOpen, true)
  assert.equal(book.A.workbenchOpen, false)
  assert.equal(book.A.seenResultKey, "new")
  book = reduceChrome(book, "A", { type: "open-workbench", wide: true })
  book = reduceChrome(book, "A", { type: "success", resultKey: "newer" })
  assert.equal(book.A.previewOpen, true)
  assert.equal(book.A.workbenchOpen, false)
  book = reduceChrome(book, "A", { type: "dismiss-preview" })
  assert.equal(book.A.previewOpen, false)
  book = reduceChrome(book, "A", { type: "success", resultKey: "newer" })
  assert.equal(book.A.previewOpen, false)

  book = reduceChrome(book, "D", { type: "prime", resultKey: "" })
  book = reduceChrome(book, "D", { type: "success", resultKey: "d1" })
  assert.equal(book.D.previewOpen, true)
  book = reduceChrome(book, "B", { type: "prime", resultKey: "" })
  book = reduceChrome(book, "B", { type: "success", resultKey: "b1" })
  assert.equal(book.B.previewOpen, false)
  assert.equal(book.B.seenResultKey, "b1")
})

test("narrow D closes the other bottom sheet; wide D can keep both", () => {
  let book = reduceChrome(createChromeBook(), "D", { type: "open-workbench", wide: true })
  book = reduceChrome(book, "D", { type: "open-preview", wide: true })
  assert.equal(book.D.previewOpen, true)
  assert.equal(book.D.workbenchOpen, true)
  book = reduceChrome(book, "D", { type: "open-preview", wide: false })
  assert.equal(book.D.previewOpen, true)
  assert.equal(book.D.workbenchOpen, false)
  book = reduceChrome(book, "D", { type: "open-workbench", wide: false })
  assert.equal(book.D.previewOpen, false)
  assert.equal(book.D.workbenchOpen, true)
})

test("placement and header chrome follow the container, not a fifth layout", () => {
  assert.equal(isStudioWide(1024), true)
  assert.equal(isStudioWide(1023), false)
  assert.equal(workbenchPlacement("B", true), "right")
  assert.equal(workbenchPlacement("B", false), "bottom")
  assert.equal(workbenchPlacement("A", true), "bottom")
  assert.equal(workbenchPlacement("D", true), "bottom")
  assert.equal(previewDrawerPlacement(true), "right")
  assert.equal(previewDrawerPlacement(false), "bottom")
  assert.equal(showHeaderSettings("A"), false)
  assert.equal(showHeaderSettings("B"), true)
  assert.equal(showHeaderLibraryTabs("C"), true)
  assert.equal(showHeaderLibraryTabs("D"), false)
  assert.equal(showMobileWorkOrder("C"), true)
  assert.equal(showMobileWorkOrder("A"), false)
  assert.equal(libraryHeading("poses"), "动作姿势库")
  assert.equal(libraryHeading("costumes"), "服装库")
  assert.equal(libraryHeading("faces"), "脸部库")
  const book = reduceChrome(createChromeBook(), "B", { type: "set-model-strip", open: true })
  assert.equal(book.B.modelStripOpen, true)
  assert.equal(reduceChrome(book, "B", { type: "set-model-strip", open: false }).B.modelStripOpen, false)
})
