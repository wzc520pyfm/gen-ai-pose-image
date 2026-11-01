# Lanzi Library-First Layouts A/B/D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw layouts A, B, and D so the pose / costume / face library is the stage, the workbench can collapse, and Web plus the DeepSeek Harness plugin share that shell.

**Architecture:** Keep selection, generate, and provider code in `StudioFrame`. Add pure helpers for recipe chips, overlay chrome, layout projection, and portal props, then compose one recipe bar (`dock` / `strip` / `pill`) and one workbench drawer around the existing `PoseBrowser`, `CostumeBrowser`, `FaceBrowser`, `PreviewPane`, `Composer`, and `CharacterDock`. Layout C’s three-column grid and narrow `去生图` sheet stay. Hidden preview and workbench regions unmount. Container queries (`@min-[1024px]/studio`) decide stacking and drawer placement.

**Tech Stack:** Next.js 15.5, React 19, Tailwind CSS v4, `@heroui/react` + `@heroui/styles` `^3.2.7` (already installed; do not bump), `node --test` on `shared/*.test.mjs`, esbuild harness client (`scripts/build-client.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-01-lanzi-library-first-layouts-design.md`. Where it disagrees with `docs/superpowers/specs/2026-11-01-lanzi-heroui-studio-design.md` about A/B/D, the library-first spec wins. Layout C, `lanzi.studio.layout`, and generate/provider contracts stay.

## Global Constraints

- Keep layouts A, B, C, D. Default remains `C`. Do not add a fifth layout, a gallery route, or a dark production theme.
- Production color stays light (`DESIGN.md`): page light, white surfaces, primary `#2563eb`. Use `#0f172a` only on A’s rail, B’s model strip, and the recipe bar / pill.
- `changeLayout` writes only `lanzi.studio.layout`. Pose, costume, face, model, prompt, results, library, and in-flight generate survive a switch. Do not persist `previewOpen`, `workbenchOpen`, `modelStripOpen`, or `dismissed` / seen result keys. Illegal layout values stay silent and fall back to `C`.
- Hidden regions unmount. The library is never hidden. Do not render stub preview columns.
- C: header library switch, left `CharacterDock`, center library, right `Composer` from `@min-[1024px]/studio`. Below that, keep the bottom `去生图` `Sheet`. No A/B/D recipe on C. No `mobileWorkOrderTrigger` on A/B/D. Do not mount `PreviewPane` as a C column.
- HeroUI v3 only: no `HeroUIProvider`, no v2 names (`Navbar`, v2 `useDisclosure`). Compound slots. `Button` uses `onPress`. CSS import order stays `@import "tailwindcss"` then `@import "@heroui/styles"`.
- Breakpoints are `@container/studio` (`@min-[1024px]/studio` / `@max-[1023px]/studio`), not viewport media queries. Wide means container width `>= 1024`.
- Overlays (`Drawer`, `Modal`, `Sheet`, `Dropdown`/`Popover`, `Select` popover, and `Tooltip` if one is added) spread `UNSTABLE_portalContainer` from `useStudioEnv().portalContainer` when it is non-null. Web passes null.
- Do not change Seedream, Gemini, OpenAI, or ComfyUI contracts, timeouts, or Hobby `maxDuration`. Do not bump npm, merge, or publish. Do not touch unrelated PRs.
- Busy copy is `正在生成 · Ns` with a visible danger `停止`. `随机组合` stays coral outline (`border-[#fb7185]/50 bg-[#fff1f2] text-[#be123c]`), not primary blue.
- Harness client externals stay `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`. No second plugin stylesheet.
- Card information stays: image, one-line title, category, angle thumbs, `看线稿`, selected state. Hover and focus still swap the large pose angle. Primary press still toggles selection. Selected badge text is `已选`.
- Filters scroll with the grid (not sticky). Pose titles stay one line with ellipsis.

## File map

| Path | Role |
|------|------|
| `shared/studio-recipe.mjs` | Chip labels, `配方 n/3`, generate block, busy copy, recipe alerts, chip → library |
| `shared/studio-recipe.test.mjs` | node:test for the recipe model |
| `shared/studio-chrome.mjs` | Per-layout overlay memory, success auto-open, narrow D mutual exclusion, placements, header chrome flags |
| `shared/studio-chrome.test.mjs` | node:test for chrome |
| `shared/studio-portal.mjs` | `overlayPortalProps(container)` |
| `shared/studio-portal.test.mjs` | node:test for portal props |
| `shared/studio-layout.mjs` | Add `projectLayoutChange` (layout id only) |
| `shared/studio-layout.test.mjs` | Assert selection fields survive a layout projection |
| `lib/studio-env.tsx` | `useOverlayPortal()` |
| `lib/use-studio-wide.ts` | `ResizeObserver` on the studio container |
| `components/studio-library-tabs.tsx` | Horizontal HeroUI `Tabs` for C header, B column, D stage |
| `components/studio-recipe.tsx` | Recipe `Surface`: variants `dock` / `strip` / `pill` |
| `components/studio-workbench.tsx` | `Drawer` body: optional collapsed model `Disclosure` + `Composer` |
| `components/studio-model-strip.tsx` | B’s rail `Disclosure` + `CharacterDock` |
| `components/studio-preview.tsx` | Honest empty copy; A focus `Card`; rewrite `LayoutARail` as vertical `Tabs` |
| `components/studio-layouts.tsx` | A/B/D grids; C unchanged |
| `components/studio-shell.tsx` | Hide settings on A; portal the layout menu; container ref |
| `components/studio.tsx` | Wire chrome, recipe, drawers; C-only sheet; `changeLayout` unchanged in effect |
| `components/composer.tsx` | Shared generate-block helper; `showRandom` so A/B/D do not duplicate `随机组合` |
| `components/character-dock.tsx` | `embedded` drops full-height column chrome inside drawers and the strip |
| `components/pose-browser.tsx` | `SearchField`, `Select`, `ToggleButtonGroup`, `Card`, `Chip`, `Skeleton`, `Alert`, portal |
| `components/costume-browser.tsx` | Same library widgets |
| `components/face-browser.tsx` | Same library widgets |
| `components/settings-dialog.tsx`, `components/history-panel.tsx`, `components/custom-reference-panel.tsx` | Portal on `Modal.Backdrop` |
| `components/studio-timeline.tsx` | Delete after D no longer imports it |
| `package.json` | Append the three new test files to `scripts.test` |

---

### Task 1: Recipe model

**Files:**
- Create: `shared/studio-recipe.mjs`
- Create: `shared/studio-recipe.test.mjs`
- Modify: `package.json` `scripts.test` (append `shared/studio-recipe.test.mjs`)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `buildRecipe({ face, costume, poses, keepOutfit })` → `{ chips, score, scoreLabel }`
  - chip: `{ id, kind: "face"|"costume"|"pose", label, removable }`
  - `libraryForRecipeChip(chip)` → `"faces"|"costumes"|"poses"`
  - `poseLimit(mode)` → `4` when `mode === "sheet"`, else `8`
  - `generateBlocked({ poseCount, localMode, hasCostume, mode })` → boolean
  - `busyLabel(elapsed)` → `` `正在生成 · ${elapsed}s` ``
  - `recipeAlerts({ workbenchOpen, runError, limitNote })` → `[{ id, status, text }]`
  - `showViewResult(layout, previewOpen, hasImage)` → boolean
  - `showRecipeRandom(layout)` / `showHeaderRandom(layout)` → boolean

- [ ] **Step 1: Write the failing test**

Create `shared/studio-recipe.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test shared/studio-recipe.test.mjs`

Expected: FAIL, cannot find module `../shared/studio-recipe.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `shared/studio-recipe.mjs` with the functions the test names. Chip rules:

- Face: `脸 · {id}` removable when selected, else `保持原脸` not removable.
- Costume: `服 · {id}` removable when selected, else `保持服装` when `keepOutfit`, else `未指定服装`. Placeholders are not removable.
- Poses: up to three `姿 · {title}` removable chips with `id` equal to the pose id. Zero poses → `未选姿势` id `poses-empty`. More than three → one `+N` chip id `poses-more`, not removable.
- `score` is 1 for a face, 1 for a costume, 1 for a non-empty pose list. `scoreLabel` is `` `配方 ${score}/3` ``.
- `recipeAlerts` returns nothing while `workbenchOpen`. Otherwise include non-empty `runError` (`status: "danger"`) and non-empty `limitNote` (`status: "warning"`), in that order.
- `showViewResult`: layout `D` is always true; layout `A` is true only when the preview is closed and `hasImage`; B and C are false.
- `showHeaderRandom` is layout `A` only. `showRecipeRandom` is `B` or `D`.

Append `shared/studio-recipe.test.mjs` to the `npm test` script in `package.json`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test shared/studio-recipe.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/studio-recipe.mjs shared/studio-recipe.test.mjs package.json
git commit -m "test: add the library-first recipe chip model"
```

---

### Task 2: Overlay chrome and layout projection

**Files:**
- Create: `shared/studio-chrome.mjs`
- Create: `shared/studio-chrome.test.mjs`
- Modify: `shared/studio-layout.mjs`
- Modify: `shared/studio-layout.test.mjs`
- Modify: `package.json` `scripts.test` (append `shared/studio-chrome.test.mjs`)

**Interfaces:**
- Consumes: `normalizeStudioLayout` from `shared/studio-layout.mjs`
- Produces:
  - `emptyChrome()` → `{ previewOpen: false, workbenchOpen: false, modelStripOpen: false, seenResultKey: null }`
  - `createChromeBook()` → `{ A, B, C, D }` each `emptyChrome()`
  - `reduceChrome(book, layout, action)` where action is
    - `{ type: "prime", resultKey }`
    - `{ type: "success", resultKey }`
    - `{ type: "dismiss-preview" }`
    - `{ type: "open-preview", wide }`
    - `{ type: "open-workbench", wide }`
    - `{ type: "close-workbench" }`
    - `{ type: "set-model-strip", open }`
  - `workbenchPlacement(layout, wide)` → `"right"` for B when wide, otherwise `"bottom"`
  - `previewDrawerPlacement(wide)` → `"right"` when wide, else `"bottom"`
  - `isStudioWide(width)` → `width >= 1024`
  - `showHeaderSettings(layout)` → false only for `A`
  - `showHeaderLibraryTabs(layout)` → true only for `C`
  - `showMobileWorkOrder(layout)` → true only for `C`
  - `libraryHeading(library)` → `动作姿势库` / `服装库` / `脸部库`
  - `projectLayoutChange(state, next)` from `shared/studio-layout.mjs`

Chrome rules to lock in tests:

- Defaults: every overlay closed, B’s strip closed (`modelStripOpen` false).
- `prime` stores `seenResultKey` and does not open preview. Used the first time a layout is observed so entering A with an existing image stays closed.
- `success` on A or D, when `resultKey` is non-empty and different from `seenResultKey`, sets `seenResultKey`, `previewOpen: true`, `workbenchOpen: false`. Same key is a no-op. B and C only update `seenResultKey`.
- `dismiss-preview` sets `previewOpen: false` and leaves `seenResultKey` so the same image does not reopen.
- `open-preview` sets `previewOpen: true`. On D when `wide` is false, also sets `workbenchOpen: false`.
- `open-workbench` sets `workbenchOpen: true`. On D when `wide` is false, also sets `previewOpen: false`. On D when `wide` is true, leaves `previewOpen` as it was.
- Reducing A does not change B’s object. A later reduce of A still sees A’s flags.
- `projectLayoutChange` replaces `layout` only. Pose map, costume, face, model id, prompt, results, and library stay.

- [ ] **Step 1: Write the failing tests** covering the rules above, including a selection snapshot:

```js
const before = {
  layout: "C",
  library: "poses",
  selected: { p1: "v1" },
  costume: { id: "C9" },
  face: { id: "F1" },
  activeModelId: "dafeiyu",
  extraPrompt: "海边",
  results: [{ key: "r1" }],
}
const after = projectLayoutChange(before, "A")
assert.equal(after.layout, "A")
assert.equal(after.selected, before.selected)
assert.equal(after.costume, before.costume)
assert.equal(after.face, before.face)
assert.equal(after.activeModelId, before.activeModelId)
assert.equal(after.extraPrompt, before.extraPrompt)
assert.equal(after.results, before.results)
assert.equal(after.library, before.library)
assert.equal(projectLayoutChange(before, "nope").layout, "C")
```

- [ ] **Step 2: Run** `node --test shared/studio-chrome.test.mjs shared/studio-layout.test.mjs` and confirm the new assertions fail.

- [ ] **Step 3: Implement** the helpers. `reduceChrome` returns a new book and a new chrome object for `layout` only when something changes. `projectLayoutChange` is `{ ...state, layout: normalizeStudioLayout(next) }`.

- [ ] **Step 4: Re-run the same command.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/studio-chrome.mjs shared/studio-chrome.test.mjs shared/studio-layout.mjs shared/studio-layout.test.mjs package.json
git commit -m "test: lock layout chrome and selection-preserving layout changes"
```

---

### Task 3: Portal prop helper

**Files:**
- Create: `shared/studio-portal.mjs`
- Create: `shared/studio-portal.test.mjs`
- Modify: `lib/studio-env.tsx`
- Modify: `package.json` `scripts.test` (append `shared/studio-portal.test.mjs`)

**Interfaces:**
- Produces: `overlayPortalProps(container)` → `{}` when `container` is null or undefined, otherwise `{ UNSTABLE_portalContainer: container }`.
- `useOverlayPortal()` in `lib/studio-env.tsx` calls that helper with `useStudioEnv().portalContainer`.

- [ ] **Step 1: Failing test**

```js
import assert from "node:assert/strict"
import { test } from "node:test"
import { overlayPortalProps } from "../shared/studio-portal.mjs"

test("overlay portal props", () => {
  assert.deepEqual(overlayPortalProps(null), {})
  assert.deepEqual(overlayPortalProps(undefined), {})
  const host = { nodeType: 11 }
  assert.deepEqual(overlayPortalProps(host), { UNSTABLE_portalContainer: host })
})
```

- [ ] **Step 2: Run** `node --test shared/studio-portal.test.mjs` and confirm FAIL.

- [ ] **Step 3: Implement** the helper and the hook. Do not invent a second portal prop.

- [ ] **Step 4: Re-run.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/studio-portal.mjs shared/studio-portal.test.mjs lib/studio-env.tsx package.json
git commit -m "test: portal studio overlays into the harness shadow root"
```

---

### Task 4: Recipe bar, workbench drawer, model strip, rail

**Files:**
- Create: `components/studio-library-tabs.tsx`
- Create: `components/studio-recipe.tsx`
- Create: `components/studio-workbench.tsx`
- Create: `components/studio-model-strip.tsx`
- Modify: `components/studio-preview.tsx`
- Modify: `components/character-dock.tsx`
- Modify: `components/composer.tsx`

**Interfaces:**
- Consumes: Task 1–3 helpers, `useOverlayPortal()`
- Produces the components `StudioFrame` will mount

`LibraryTabs` props: `{ library: "poses"|"costumes"|"faces", onLibrary, labels: "short"|"full" }`. Short labels are `姿` / `服` / `脸` (A rail only; the rail does not use this horizontal component). Full labels are `姿势` / `服装` / `脸部`. Render:

```tsx
<Tabs selectedKey={library} onSelectionChange={(key) => onLibrary(String(key) as Library)}>
  <Tabs.ListContainer>
    <Tabs.List aria-label="图库">
      <Tabs.Tab id="poses">{label}<Tabs.Indicator /></Tabs.Tab>
      <Tabs.Tab id="costumes">{label}<Tabs.Indicator /></Tabs.Tab>
      <Tabs.Tab id="faces">{label}<Tabs.Indicator /></Tabs.Tab>
    </Tabs.List>
  </Tabs.ListContainer>
</Tabs>
```

`LayoutARail` becomes a 72px column, `bg-[#0f172a] text-slate-100`, that does not scroll. Vertical `Tabs` `orientation="vertical"` with the short labels, plus a bottom `Button` `variant="secondary"` `aria-label="生图设置"` `onPress={onOpenSettings}` labeled `设`. New prop `onOpenSettings`.

`PreviewPane` empty copy becomes `还没有成图。选好配方后点生图。` Spread `useOverlayPortal()` on the lightbox `Modal.Backdrop`.

`PreviewFocus` (export from `studio-preview.tsx`): when `open` is false, return null. When open, an absolute scrim (`bg-white/70`) closes on click and on Escape. Centered `Card` `max-h-[min(70dvh,40rem)]` with width `min(56rem, 70%)`, and `@max-[1023px]/studio:w-[calc(100%-24px)]`. `CloseButton` `aria-label="关闭成图"`. Body is `PreviewPane`. Clicking the card does not close. No settings button on the card.

`RecipeBar` props include `variant: "dock"|"strip"|"pill"`, the `buildRecipe` result, `running`, `elapsed`, `blocked`, `onGenerate`, `onStop`, `onOpenWorkbench`, `onActivateChip`, `onRemoveChip`, `alerts`, optional `onViewResult` (render `看成图` only when provided), optional `onRandom` (render coral `随机组合` only when provided). Root is `Surface` `data-region="recipe"` `data-variant={variant}` with `bg-[#0f172a] text-slate-100`. `dock` is full width with `pb-[max(0.75rem,env(safe-area-inset-bottom))]`. `strip` is full width of its column. `pill` is `rounded-full shadow-lg`. Chips are one `TagGroup` with `onRemove`. Each chip is `Tag` `textValue={label}`; call `onActivateChip` from the tag (not from the remove control). Render `Tag.RemoveButton` only when `chip.removable`. Show `scoreLabel`, a `工作单` `Button`, then either `Spinner` + `busyLabel(elapsed)` + danger `停止`, or a primary `生图` `Button` with `isDisabled={blocked}`. Map `alerts` to `Alert` `status={alert.status}` once each. `flex-wrap` so the dock wraps under 1024.

`WorkbenchDrawer` props: `open`, `onOpenChange`, `placement: "bottom"|"right"`, `includeDock`, `modelName`, `dockExpanded`, `onDockExpanded`, `dock`, `composer`. `Drawer.Backdrop` gets `useOverlayPortal()` and `isOpen` / `onOpenChange`. Bottom placement uses `Drawer.Handle` and `max-h-[min(85dvh,720px)]`. Right placement uses `w-[min(400px,100%)]`. When `includeDock`, body is `ScrollShadow` containing a controlled `Disclosure` (`isExpanded` / `onExpandedChange`) titled with `modelName`, default closed by the parent, then `Separator`, then `composer`. When `includeDock` is false, body is `composer` only. Unmount nothing inside while open; the parent unmounts the whole drawer only if that is simpler — prefer keeping `Drawer` mounted with `isOpen` so exit animation works, but do not mount `Composer` twice. One composer instance: the drawer body when the layout uses a drawer, the C column/sheet when layout is C.

`ModelStrip` props: `open`, `onOpenChange`, `name`, `thumbSrc`, `dock`. Rail `Surface` `bg-[#0f172a]`. Collapsed `Disclosure` trigger shows `Avatar` (`Avatar.Image` + `Avatar.Fallback`), the name, and `Disclosure.Indicator`. `Disclosure.Content` renders `dock`.

`CharacterDock` gains `embedded?: boolean`. When true, the aside does not use `h-full`, `order-1`, or `mt-auto` (content height inside a disclosure). C omits the prop.

`Composer` imports `generateBlocked` and uses it for `isDisabled`. New prop `showRandom?: boolean` default `true`. When false, omit the coral `随机组合` button. C leaves the default.

- [ ] **Step 1: Implement the components** against the interfaces. No new test runner; behavior is covered by Tasks 1–3 and the later `npm test` plus browser smoke.

- [ ] **Step 2: Typecheck the new files**

Run: `npx tsc --noEmit --pretty false`

Expected: no errors in the new files. Existing errors, if any, get fixed in this task only when this task caused them.

- [ ] **Step 3: Commit**

```bash
git add components/studio-library-tabs.tsx components/studio-recipe.tsx components/studio-workbench.tsx components/studio-model-strip.tsx components/studio-preview.tsx components/character-dock.tsx components/composer.tsx
git commit -m "feat: add recipe bar, workbench drawer, and library tabs"
```

---

### Task 5: Layout grids A/B/D and shell chrome

**Files:**
- Modify: `components/studio-layouts.tsx`
- Modify: `components/studio-shell.tsx`
- Modify: `components/studio.tsx`
- Delete: `components/studio-timeline.tsx` once nothing imports it
- Create: `lib/use-studio-wide.ts`

**Interfaces:**
- Consumes: Task 4 components and Task 2 reducers
- `StudioRegions` gains `recipe?`, `modelStrip?`, `previewOverlay?`, `workbenchDrawer?`, `libraryHeading?`, `librarySwitch?`. `timeline` and the old A/B/D columns go away.

Grid rules:

- **A:** `grid-cols-[72px_minmax(0,1fr)]`. Rail slot is `libraryRail` (no overflow on the rail). Stage is `ScrollShadow` around `library`. No preview column and no dock/composer column. `recipe` is a docked footer. `previewOverlay` and `workbenchDrawer` are siblings, not columns.
- **B:** default `flex-col`; `@min-[1024px]/studio:grid` with `minmax(0,1.4fr)` and `minmax(300px,0.8fr)`. Left: `librarySwitch`, scrolling library, `modelStrip`. Right: `PreviewPane` on `bg-[#f7f4ee]`, then `recipe` strip. Narrow order is the same stack. `workbenchDrawer` is a sibling. Do not mount `characterDock` or `workOrder` in the grid.
- **D:** `librarySwitch`, `libraryHeading` (`h2`), `ScrollShadow` library with `pb-28` so the last row clears the pill. Pill is `absolute inset-x-0 bottom-0 z-20 flex justify-center` with safe-area padding, `pointer-events-none` on the wrapper and `pointer-events-auto` on the pill. No side-by-side preview. No `TimelineBar`.
- **C:** keep the current three-column markup byte-for-structure: dock, library, work order hidden below 1024. Do not render recipe, preview, rail, or timeline.

`StudioShell`:
- Accept `containerRef` and put it on the `@container/studio` root.
- Accept `showSettings` and `headerRandom`.
- Render the settings `Button` only when `showSettings`.
- Spread `useOverlayPortal()` on `Dropdown.Popover`.
- Still render `mobileWorkOrderTrigger` only when the parent passes it.

`StudioFrame`:
- `const chromeBook` state from `createChromeBook()`. `const chrome = chromeBook[layout]`.
- `useStudioWide(studioRef)` drives `wide`.
- `changeLayout` is only `setLayout(projectLayoutChange({ layout }, next).layout)` and `saveStudioLayout` of that id. It does not reset selection, chrome, prompt, or results.
- Latest successful result key: last `results` item with `ok && src`, using `key`. A ref set records layouts that have been primed. On `[layout, latestKey]`, dispatch `prime` the first time that layout is seen, otherwise `success`.
- Recipe handlers call the same `onClearFace`, `onClearCostume`, pose `onRemove`, `setLibrary`, `generate`, and `abortRef` as the composer. Activating a chip only calls `setLibrary(libraryForRecipeChip(chip))`.
- `随机组合` button in the header only when `showHeaderRandom(layout)`.
- Header library tabs only when `showHeaderLibraryTabs(layout)` (C), still followed by the face id and costume id spans.
- `mobileWorkOrderTrigger` is built only when `showMobileWorkOrder(layout)`. `reuse()` opens that sheet when `layout === "C" && !wide` (replace `window.innerWidth`).
- A and D: `previewOpen` mounts `PreviewFocus` (A) or a preview `Drawer` (D, placement `previewDrawerPlacement(wide)`, bottom max height `70dvh`, right width `min(440px, 100%)`). Both portal. D’s `看成图` is always passed. A’s `看成图` is passed only when `showViewResult` is true.
- Workbench `placement` is `workbenchPlacement(layout, wide)`. `includeDock` is true for A and D, false for B. B’s dock is `ModelStrip` bound to `chrome.modelStripOpen`.
- Composer `showRandom={layout === "C"}`. A/B/D pass `showRandom={false}` into the drawer composer.
- Delete `TimelineBar` import and `components/studio-timeline.tsx`. Delete `LayoutARail` raw buttons by using the rewritten rail.

- [ ] **Step 1: Wire the grids and frame** as specified. Grep to confirm `TimelineBar`, `studio-timeline`, and `window.innerWidth` are gone, and that `mobileWorkOrderTrigger` is not passed for A/B/D.

- [ ] **Step 2: Run** `npx tsc --noEmit --pretty false` and `node --test shared/studio-recipe.test.mjs shared/studio-chrome.test.mjs shared/studio-portal.test.mjs shared/studio-layout.test.mjs`.

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/studio-layouts.tsx components/studio-shell.tsx components/studio.tsx components/studio-preview.tsx lib/use-studio-wide.ts
git add -u components/studio-timeline.tsx
git commit -m "feat: mount library-first layouts A, B, and D"
```

---

### Task 6: HeroUI library cards and filters

**Files:**
- Modify: `components/pose-browser.tsx`
- Modify: `components/costume-browser.tsx`
- Modify: `components/face-browser.tsx`

Keep every handler, empty state, error retry, adult gate, custom references, attribution, hover/focus angle swap, and the set of filters. Replace the widgets:

- Search `Input` blocks → `SearchField` + `SearchField.Group` + `SearchField.SearchIcon` + `SearchField.Input` + `SearchField.ClearButton`. `onChange` receives the string.
- Pose category `<select>` → `Select` / `Select.Trigger` / `Select.Value` / `Select.Indicator` / `Select.Popover` / `ListBox` / `ListBox.Item`. Spread `useOverlayPortal()` on `Select.Popover`.
- Pose series pills, pose angle segments, costume category pills, face section pills, and face hair segments → `ToggleButtonGroup` `selectionMode="single"` plus `ToggleButton`. Disallow clearing the last key (ignore empty selection). Adult series still call `onRequestAdult` instead of selecting when locked; do that from `ToggleButton` `onPress` before the group would select, or keep the adult items as `Button`s inside the same row if a toggle cannot cancel. The visible set of series, categories, sections, and angles must stay.
- Pose `article`, costume button card, and face button card → `Card`, `Card.Header` (image), `Card.Title` (one-line ellipsis), `Card.Description`, `Card.Footer` (pose angle thumbs; costume/face caption). Selected state uses `Chip` `color="accent"` `size="sm"` text `已选`. Primary press still toggles selection. `看线稿` stays on the pose card.
- Loading placeholders → `Skeleton`.
- Load errors → `Alert` `status="danger"` with the existing retry `Button`.
- Pose line-art `Modal.Backdrop` spreads `useOverlayPortal()`.
- Do not add a second library switch inside the browsers. Do not sticky the filter row.

- [ ] **Step 1: Migrate the three browsers.**

- [ ] **Step 2: Run** `npx tsc --noEmit --pretty false`.

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/pose-browser.tsx components/costume-browser.tsx components/face-browser.tsx
git commit -m "feat: render library cards and filters with HeroUI"
```

---

### Task 7: Portal the remaining overlays

**Files:**
- Modify: `components/studio.tsx` (`Modal.Backdrop` for install and adult, `Sheet.Backdrop` for C)
- Modify: `components/settings-dialog.tsx`
- Modify: `components/history-panel.tsx`
- Modify: `components/custom-reference-panel.tsx`
- Modify: `components/studio-shell.tsx` if Task 5 missed the dropdown

Spread `useOverlayPortal()` onto each `Modal.Backdrop`, `Sheet.Backdrop`, `Drawer.Backdrop`, `Dropdown.Popover`, and `Select.Popover`. There is no `Tooltip` in the studio today; do not add one only to satisfy the list. Any new tooltip must use the same helper.

- [ ] **Step 1: Add the spreads.** Grep `Modal.Backdrop`, `Sheet.Backdrop`, `Drawer.Backdrop`, `Dropdown.Popover`, `Select.Popover` and confirm each receives the helper.

- [ ] **Step 2: Commit**

```bash
git add components/studio.tsx components/settings-dialog.tsx components/history-panel.tsx components/custom-reference-panel.tsx components/studio-shell.tsx components/studio-preview.tsx components/pose-browser.tsx
git commit -m "fix: portal studio overlays into the harness shadow root"
```

---

### Task 8: Acceptance

**Files:** none new, unless a test or type error forces a fix.

- [ ] **Step 1: Run the project test script**

Run: `npm test`

Expected: client build writes `plugin/client.js`, every `shared/*.test.mjs` file in the script passes, and the harness bundle does not require extra modules. Commit `plugin/client.js` if the build changes it:

```bash
git add plugin/client.js
git commit -m "chore: rebuild the harness client for library-first layouts"
```

- [ ] **Step 2: Smoke the web studio**

Run: `npm run dev` (port 43123). Open `/`. For layouts A, B, C, and D confirm:

1. A shows a pose grid and a vertical `姿` / `服` / `脸` rail. Closing preview leaves the grid and no empty preview column. Recipe is a dock. `工作单` opens a bottom drawer. Header has `随机组合` and no settings gear. Rail `设` opens settings.
2. B shows the grid and a persistent preview, a collapsed model strip that expands into the dock, and a composer only inside the drawer. `随机组合` is on the strip.
3. D has no side-by-side preview. `看成图` opens a drawer. The pill sits above the last card row. `TimelineBar` is gone.
4. Search, category or section filter, empty, and error UI still exist on the visible library. Pose hover still changes angle.
5. Select a pose, costume, and face on A, switch B → D → C → A, and the same three stay selected.
6. With nothing selected, `生图` is disabled. The running state is covered by `busyLabel` in unit tests; if a provider key is absent, do not call a live provider. Confirm the stop control is in the recipe component source and the unit test.
7. C is still three columns at a wide container and still shows `去生图` when the studio container is under 1024px. C has no recipe bar.
8. Light page. `#0f172a` only on the A rail, B strip, and recipe surfaces.

Capture screenshots of A, B, C, and D.

- [ ] **Step 3: Plugin note**

`npm test` already runs `build:client`. If a local harness host is not available, record that the client bundle rebuilt and overlays call `useOverlayPortal()`, and that a live Harness panel was not opened.

## Spec coverage

| Spec acceptance | Task |
| --- | --- |
| A grid + rail, closable preview, dock, bottom drawer | 4, 5 |
| B library + persistent preview + collapsed strip + drawer composer | 4, 5 |
| D full-bleed library, pill, preview drawer, no TimelineBar | 5 |
| Hidden regions unmounted, library always mounted | 2, 5 |
| HeroUI v3 kit beyond Button/Input/Modal | 4, 6 |
| Selection survives layout switch; one storage key | 2, 5 |
| Busy `正在生成 · Ns` and visible 停止; coral 随机组合 | 1, 4 |
| `portalContainer` | 3, 7 |
| `@container/studio` breakpoints | 2, 5 |
| C unchanged IA, no recipe, no mobile trigger on A/B/D | 5 |
| `npm test` and web smoke | 8 |

## Self-review

- No fifth layout, no dark gallery theme, no provider or version edits.
- Placeholder chips are not removable. `+N` does not remove poses.
- Alerts render on the recipe only while the workbench drawer is closed.
- Generate from the recipe does not open the drawer. A new success on A/D opens preview and leaves the workbench closed.
- Chrome is per layout id in React state, so A → B → A restores A’s flags.
