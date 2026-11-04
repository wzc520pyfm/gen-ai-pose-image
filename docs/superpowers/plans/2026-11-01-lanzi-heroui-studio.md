# Lanzi HeroUI One-Screen Studio Implementation Plan

> **Shipping status:** The layout switcher and layouts A, B, and D were removed. Ship layout C only, plus light/dark theme. Tasks below that add A–D are historical.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Lanzi one-screen studio IA with `StudioShell` + layouts A–D and migrate Web + DeepSeek Harness plugin UI to official `@heroui/react`, without changing generate/provider contracts.

**Architecture:** Extract layout preference + shell slots from `components/studio.tsx`. Keep selection/generate state in `StudioFrame`. Swap shadcn/base-ui primitives for HeroUI v3 compound components. Plugin continues to bundle the same `Studio` via `scripts/build-client.mjs` (shadow CSS must include HeroUI styles).

**Tech Stack:** Next.js 15.5, React 19, Tailwind CSS v4, `@heroui/react` + `@heroui/styles` (v3), existing `node --test` in `shared/`, esbuild harness client.

**Spec:** `docs/superpowers/specs/2026-11-01-lanzi-heroui-studio-design.md`

## Global Constraints

- Branch from latest `origin/main` (includes face library #24, Comfy browser-direct #26, hover pose angles #30). Do not implement on the stale local tip that lacked faces.
- Web and plugin migrate together (same components); plugin is not deferred.
- Layout key `lanzi.studio.layout`, default `C`; switching layouts must not clear pose/costume/face/model selection.
- Layout menu sits in the header top-right (with settings / install actions).
- All four layouts A/B/C/D are user-selectable.
- Theme: HeroUI default + brand blue fine-tune from `DESIGN.md` (`primary` / accent ≈ `#2563eb`, rail `#0f172a`).
- Busy copy stays short: `正在生成 · Ns` with visible 停止; do not crowd the stop control.
- Do not change Seedream/Comfy timeouts or API contracts; do not bump npm or merge unrelated PRs (#28/#29) unless the user asks.
- PR titles English-only; PR body English-first bilingual if opened.
- HeroUI v3: no `HeroUIProvider`; use compound APIs (`Card.Header`); prefer `onPress` on `Button`; CSS import order is `@import "tailwindcss"` then `@import "@heroui/styles"`.
- Harness client may only `require` `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client` (see `scripts/build-client.mjs`).
- Existing product constraints remain: compact pose cards, title ellipsis, filters scroll with page (not sticky), face optional without model, result click-to-zoom, random-捏人 non-primary accent color.

---

## File map

| Path | Role |
|------|------|
| `lib/studio-layout.ts` | Layout id type, normalize, load/save `localStorage` |
| `shared/studio-layout.test.mjs` | Unit tests for layout helpers (node:test) |
| `components/studio-shell.tsx` | Header chrome + layout switcher + slot grid for A–D |
| `components/studio-layouts.tsx` | Pure grid compositions for layouts A–D |
| `components/studio.tsx` | Keep generate/selection state; render regions into shell slots |
| `app/globals.css` | Drop shadcn import; add `@heroui/styles`; brand token overrides |
| `plugin/harness.css` | Still `@import "../app/globals.css"`; verify `:host` + HeroUI survive build |
| `components/ui/*` | Remove usages; delete unused shadcn wrappers once migration done |
| `package.json` | Add `@heroui/react`, `@heroui/styles`; remove `@base-ui/react` / `shadcn` when unused |
| `components/{composer,character-dock,pose-browser,costume-browser,face-browser,settings-dialog,history-panel,custom-reference-panel}.tsx` | Replace `@/components/ui/*` with `@heroui/react` |
| `docs/superpowers/specs/2026-11-01-lanzi-heroui-studio-design.md` | Already written; ensure present on the feature branch |

---

### Task 1: Feature branch from `origin/main` + carry design doc

**Files:**
- Create/ensure: `docs/superpowers/specs/2026-11-01-lanzi-heroui-studio-design.md`
- Create: branch `cursor/lanzi-heroui-studio`

**Interfaces:**
- Consumes: `origin/main` at/after `f531cfa` (Connect ComfyUI directly from the browser)
- Produces: clean working tree on feature branch including the design spec

- [ ] **Step 1: Sync and branch**

```bash
cd /path/to/gen-ai-pose-image
git fetch origin main
git checkout -B cursor/lanzi-heroui-studio origin/main
# Discard unrelated local package.json drift if present; do not commit version bumps.
git status -sb
```

Expected: branch tracks `origin/main`; `components/face-browser.tsx` exists; `package.json` version `0.2.0`.

- [ ] **Step 2: Ensure design spec is on the branch**

If missing, copy from the brainstorm commit or recreate from `docs/superpowers/specs/2026-11-01-lanzi-heroui-studio-design.md` content already approved.

```bash
test -f docs/superpowers/specs/2026-11-01-lanzi-heroui-studio-design.md
git add docs/superpowers/specs/2026-11-01-lanzi-heroui-studio-design.md
git commit -m "docs: add Lanzi HeroUI one-screen studio design spec"
```

Skip the commit if the file is already committed on this branch.

- [ ] **Step 3: Commit plan file when added**

After this plan lands on disk:

```bash
git add docs/superpowers/plans/2026-11-01-lanzi-heroui-studio.md
git commit -m "docs: add Lanzi HeroUI studio implementation plan"
```

---

### Task 2: Install HeroUI and wire global CSS

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx` only if a smoke import is needed (prefer no provider)
- Test: manual `npm run dev` + optional tiny smoke in a throwaway page later removed

**Interfaces:**
- Consumes: Tailwind v4 already via `@tailwindcss/postcss`
- Produces: HeroUI styles available in Web and (via harness import) plugin CSS pipeline

- [ ] **Step 1: Install packages**

```bash
npm install @heroui/react @heroui/styles
```

Do not remove shadcn yet (later task).

- [ ] **Step 2: Update `app/globals.css` imports**

Replace the shadcn import block at the top with:

```css
@import "tailwindcss";
@import "@heroui/styles";
@import "tw-animate-css";
```

Keep existing `@theme inline` / `:root` tokens that encode Lanzi colors, then add HeroUI brand fine-tune after HeroUI import (adjust variable names to match installed `@heroui/styles` tokens — inspect computed theme docs / CSS for `--accent` / primary equivalents):

```css
:root {
  /* Brand blue fine-tune — align with DESIGN.md primary #2563eb */
  --accent: #2563eb;
  --accent-foreground: #f8fafc;
}
```

Keep rail utilities used by `CharacterDock` (deep `#0f172a`) as existing custom classes or CSS variables `--lanzi-rail: #0f172a`.

- [ ] **Step 3: Smoke that HeroUI Button renders**

In `components/studio.tsx` header temporarily add:

```tsx
import { Button as HeroButton } from "@heroui/react"
// ...
<HeroButton size="sm" variant="secondary" onPress={() => {}}>HeroUI</HeroButton>
```

Run: `npm run dev`  
Expected: header shows a HeroUI button with styles (not unstyled native).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app/globals.css components/studio.tsx
git commit -m "chore: add HeroUI styles and smoke Button in studio header"
```

Remove the temporary HeroUI smoke button in Task 5 when the real layout menu lands (or remove in the same commit if layout menu ships next).

---

### Task 3: Layout preference module (TDD)

**Files:**
- Create: `lib/studio-layout.ts`
- Create: `shared/studio-layout.test.mjs`
- Modify: `package.json` `scripts.test` to include the new test file

**Interfaces:**
- Consumes: none
- Produces:
  - `export type StudioLayoutId = "A" | "B" | "C" | "D"`
  - `export const DEFAULT_STUDIO_LAYOUT: StudioLayoutId = "C"`
  - `export const STUDIO_LAYOUT_KEY = "lanzi.studio.layout"`
  - `export function normalizeStudioLayout(value: unknown): StudioLayoutId`
  - `export function loadStudioLayout(storage?: Storage | null): StudioLayoutId`
  - `export function saveStudioLayout(id: StudioLayoutId, storage?: Storage | null): void`

- [ ] **Step 1: Write the failing test**

Create `shared/studio-layout.test.mjs`:

```js
import assert from "node:assert/strict"
import { test } from "node:test"
import {
  DEFAULT_STUDIO_LAYOUT,
  STUDIO_LAYOUT_KEY,
  loadStudioLayout,
  normalizeStudioLayout,
  saveStudioLayout,
} from "../lib/studio-layout.ts"

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
```

If the repo's test runner cannot import `.ts` from `lib/` directly, instead put pure helpers in `shared/studio-layout.mjs` and re-export from `lib/studio-layout.ts`. Prefer `shared/studio-layout.mjs` + `lib/studio-layout.ts` thin re-export if `node --test` fails on TS.

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test shared/studio-layout.test.mjs
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement helpers**

Preferred `shared/studio-layout.mjs`:

```js
export const DEFAULT_STUDIO_LAYOUT = "C"
export const STUDIO_LAYOUT_KEY = "lanzi.studio.layout"
const ALLOWED = new Set(["A", "B", "C", "D"])

export function normalizeStudioLayout(value) {
  return ALLOWED.has(value) ? value : DEFAULT_STUDIO_LAYOUT
}

export function loadStudioLayout(storage) {
  const store = storage ?? (typeof globalThis !== "undefined" ? globalThis.localStorage : null)
  if (!store || typeof store.getItem !== "function") return DEFAULT_STUDIO_LAYOUT
  try {
    return normalizeStudioLayout(store.getItem(STUDIO_LAYOUT_KEY))
  } catch {
    return DEFAULT_STUDIO_LAYOUT
  }
}

export function saveStudioLayout(id, storage) {
  const store = storage ?? (typeof globalThis !== "undefined" ? globalThis.localStorage : null)
  if (!store || typeof store.setItem !== "function") return
  try {
    store.setItem(STUDIO_LAYOUT_KEY, normalizeStudioLayout(id))
  } catch {
    // ignore quota / private mode
  }
}
```

`lib/studio-layout.ts`:

```ts
export {
  DEFAULT_STUDIO_LAYOUT,
  STUDIO_LAYOUT_KEY,
  loadStudioLayout,
  normalizeStudioLayout,
  saveStudioLayout,
} from "../shared/studio-layout.mjs"

export type StudioLayoutId = "A" | "B" | "C" | "D"
```

Update test imports to `../shared/studio-layout.mjs`.

- [ ] **Step 4: Run tests**

```bash
node --test shared/studio-layout.test.mjs
```

Expected: PASS.

Update `package.json` scripts.test to append `shared/studio-layout.test.mjs`.

- [ ] **Step 5: Commit**

```bash
git add shared/studio-layout.mjs shared/studio-layout.test.mjs lib/studio-layout.ts package.json
git commit -m "feat: add studio layout preference helpers with tests"
```

---

### Task 4: `StudioLayouts` + `StudioShell` (structure only)

**Files:**
- Create: `components/studio-layouts.tsx`
- Create: `components/studio-shell.tsx`

**Interfaces:**
- Consumes: `StudioLayoutId` from `@/lib/studio-layout`
- Produces:
  - `StudioRegions` props type with optional ReactNodes: `headerExtra`, `libraryTabs`, `characterDock`, `library`, `workOrder`, `preview`, `timeline`
  - `StudioShellProps`: `{ layout: StudioLayoutId; embedded?: boolean; onLayoutChange: (id: StudioLayoutId) => void; regions: StudioRegions; title?: string }`
  - Renders header (brand + tabs slot + layout menu + settings slot) and the A–D grid

- [ ] **Step 1: Implement layout grids**

`components/studio-layouts.tsx`:

```tsx
"use client"

import type { ReactNode } from "react"
import type { StudioLayoutId } from "@/lib/studio-layout"

export type StudioRegions = {
  characterDock: ReactNode
  library: ReactNode
  workOrder: ReactNode
  preview: ReactNode
  timeline?: ReactNode
  libraryRail?: ReactNode // layout A vertical pose/costume/face entries
}

export function StudioLayoutGrid({
  layout,
  regions,
}: {
  layout: StudioLayoutId
  regions: StudioRegions
}) {
  if (layout === "A") {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-[72px_minmax(0,1fr)_300px] gap-3 p-3">
        <div className="min-h-0 overflow-y-auto">{regions.libraryRail ?? regions.library}</div>
        <div className="min-h-0 overflow-hidden rounded-xl border border-primary/40 bg-white">{regions.preview}</div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {regions.characterDock}
          {regions.workOrder}
        </div>
      </div>
    )
  }
  if (layout === "B") {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.2fr)_minmax(280px,0.9fr)] gap-3 p-3">
        <div className="min-h-0 overflow-y-auto rounded-xl border bg-white">{regions.library}</div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-white">{regions.preview}</div>
          {regions.workOrder}
        </div>
      </div>
    )
  }
  if (layout === "D") {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
          <div className="min-h-0 overflow-y-auto rounded-xl border bg-white">{regions.library}</div>
          <div className="min-h-0 overflow-hidden rounded-xl border border-primary/40 bg-white">{regions.preview}</div>
        </div>
        <div className="shrink-0 rounded-xl bg-slate-950 text-slate-100">{regions.timeline ?? regions.workOrder}</div>
      </div>
    )
  }
  // C default — near current: dock | library | work order
  return (
    <div className="flex min-h-0 flex-1 flex-col @min-[1024px]/studio:grid @min-[1024px]/studio:grid-cols-[300px_minmax(0,1fr)_340px]">
      {regions.characterDock}
      <main className="order-2 min-h-0 min-w-0 flex-1 overflow-y-auto @min-[1024px]/studio:order-none">
        {regions.library}
      </main>
      <aside className="hidden min-h-0 border-l bg-white px-4 py-5 @min-[1024px]/studio:block @min-[1024px]/studio:overflow-y-auto">
        {regions.workOrder}
      </aside>
    </div>
  )
}
```

- [ ] **Step 2: Implement `StudioShell` with HeroUI layout menu**

`components/studio-shell.tsx`:

```tsx
"use client"

import { Button, Dropdown, Label } from "@heroui/react"
import { LayoutGrid, Settings } from "lucide-react"
import { WhaleMark } from "@/components/whale-mark"
import { StudioLayoutGrid, type StudioRegions } from "@/components/studio-layouts"
import type { StudioLayoutId } from "@/lib/studio-layout"

const LAYOUT_OPTIONS: { id: StudioLayoutId; label: string }[] = [
  { id: "A", label: "A · 成图居中" },
  { id: "B", label: "B · 左素材右出图" },
  { id: "C", label: "C · 顶部分段 + 工作单" },
  { id: "D", label: "D · 剪辑台" },
]

export function StudioShell({
  layout,
  embedded = false,
  onLayoutChange,
  onOpenSettings,
  libraryTabs,
  headerTrailing,
  mobileWorkOrderTrigger,
  regions,
}: {
  layout: StudioLayoutId
  embedded?: boolean
  onLayoutChange: (id: StudioLayoutId) => void
  onOpenSettings: () => void
  libraryTabs: React.ReactNode
  headerTrailing?: React.ReactNode
  mobileWorkOrderTrigger?: React.ReactNode
  regions: StudioRegions
}) {
  return (
    <div className={`@container/studio flex min-h-0 flex-col overflow-hidden bg-background text-foreground ${embedded ? "h-full" : "h-dvh"}`}>
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-white px-3 py-2">
        <WhaleMark className="size-8 shrink-0" />
        <h1 className="shrink-0 text-base font-semibold">澜姿</h1>
        {libraryTabs}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {headerTrailing}
          <Dropdown>
            <Button
              variant="secondary"
              size="sm"
              aria-label="切换布局"
              className="gap-1"
            >
              <LayoutGrid className="size-4" />
              布局 {layout}
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                aria-label="布局"
                onAction={(key) => onLayoutChange(String(key) as StudioLayoutId)}
              >
                {LAYOUT_OPTIONS.map((option) => (
                  <Dropdown.Item key={option.id} id={option.id} textValue={option.label}>
                    <Label>{option.label}</Label>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          <Button variant="secondary" isIconOnly aria-label="生图设置" onPress={onOpenSettings}>
            <Settings className="size-4" />
          </Button>
        </div>
      </header>
      <StudioLayoutGrid layout={layout} regions={regions} />
      {mobileWorkOrderTrigger}
    </div>
  )
}
```

**Important:** HeroUI v3 Dropdown compound API names may differ slightly by release (`Dropdown.Trigger` wrapping the button, etc.). After install, open `node_modules/@heroui/react` type defs / docs and adjust the snippet so TypeScript passes — keep behavior: top-right menu listing A–D.

- [ ] **Step 3: Typecheck shell files**

```bash
npm run typecheck
```

Expected: PASS for new files (or only pre-existing errors unrelated to shell). Fix Dropdown API until clean.

- [ ] **Step 4: Commit**

```bash
git add components/studio-layouts.tsx components/studio-shell.tsx
git commit -m "feat: add StudioShell and A-D layout grids"
```

---

### Task 5: Wire `StudioFrame` to shell + persist layout

**Files:**
- Modify: `components/studio.tsx` (large)

**Interfaces:**
- Consumes: `loadStudioLayout`, `saveStudioLayout`, `StudioShell`, existing browsers/composer
- Produces: layout state independent of selection state; mobile sheet still hosts work order for layout C (and others that hide aside)

- [ ] **Step 1: Add layout state without clearing selections**

Near other `useState` hooks in `StudioFrame`:

```tsx
import { loadStudioLayout, saveStudioLayout, type StudioLayoutId } from "@/lib/studio-layout"
import { StudioShell } from "@/components/studio-shell"

const [layout, setLayout] = useState<StudioLayoutId>(() => loadStudioLayout())

function changeLayout(next: StudioLayoutId) {
  setLayout(next)
  saveStudioLayout(next)
}
```

Do **not** reset `selected`, `costume`, `face`, `characters`, or `results` inside `changeLayout`.

- [ ] **Step 2: Replace the outer header/grid JSX with `StudioShell`**

Build `libraryTabs` the same way as today's 姿势/服装/脸 controls (including faces from main), but pass them as the `libraryTabs` prop.

Map regions:

```tsx
regions={{
  characterDock: (
    <CharacterDock /* existing props */ />
  ),
  library: (
    library === "poses" ? <PoseBrowser {...poseProps} />
    : library === "costumes" ? <CostumeBrowser {...costumeProps} />
    : <FaceBrowser {...faceProps} />
  ),
  workOrder: composer,
  preview: (
    /* For A/B/D: show latest successful result image or empty placeholder */
    <PreviewPane results={results} />
  ),
  timeline: (
    <TimelineBar pose={...} costume={costume} face={face} onGenerate={...} running={running} onStop={...} />
  ),
  libraryRail: (
    /* compact vertical switches + mini library for layout A — can initially reuse libraryTabs vertically */
    <LayoutARail library={library} onLibrary={setLibrary} />
  ),
}}
```

If `PreviewPane` / `TimelineBar` / `LayoutARail` do not exist yet, create minimal stubs in `components/studio-preview.tsx` and `components/studio-timeline.tsx`:

`PreviewPane`: show the last `results` item with `ok && src`, click opens existing zoom dialog if present; else placeholder text `成图预览`.

`TimelineBar`: dark bar with chips for selected pose count / costume label / face label + Generate/Stop buttons.

Keep the existing mobile bottom sheet pattern via `mobileWorkOrderTrigger` for narrow viewports when layout is `C` (and optionally always).

- [ ] **Step 3: Manual verify layout persistence**

Run: `npm run dev`  
Steps: select a pose + costume + face → switch A→B→C→D→A → confirm selections remain → reload page → layout restores from `localStorage` key `lanzi.studio.layout`.

- [ ] **Step 4: Commit**

```bash
git add components/studio.tsx components/studio-preview.tsx components/studio-timeline.tsx
git commit -m "feat: wire StudioShell layouts without clearing studio selection"
```

---

### Task 6: Migrate interactive primitives to HeroUI

**Files:**
- Modify: `components/composer.tsx`, `components/character-dock.tsx`, `components/pose-browser.tsx`, `components/costume-browser.tsx`, `components/face-browser.tsx`, `components/settings-dialog.tsx`, `components/history-panel.tsx`, `components/custom-reference-panel.tsx`
- Delete gradually: `components/ui/*` once unused
- Modify: `package.json` remove `@base-ui/react`, `shadcn` when no imports remain

**Interfaces:**
- Consumes: `@heroui/react` (`Button`, `Input`, `TextArea`/`TextField`, `Modal`, `Switch`, `Select`, `Card`, `Spinner`, `Tabs` as needed)
- Produces: no remaining `@/components/ui/*` or `@base-ui/react` imports under `components/`

- [ ] **Step 1: Inventory imports**

```bash
rg -n "from \"@/components/ui|from \"@base-ui|from \"shadcn" components app lib plugin --glob '!**/client.js'
```

Expected: list of files to migrate.

- [ ] **Step 2: Migrate `composer.tsx` first (generate/stop/busy)**

Replace shadcn `Button`/`Textarea` with HeroUI. Busy row must look like:

```tsx
{running ? (
  <div className="flex items-center gap-2">
    <Spinner size="sm" />
    <span className="text-sm">正在生成 · {elapsed}s</span>
    <Button variant="danger" size="sm" onPress={onStop}>停止</Button>
  </div>
) : (
  <Button variant="primary" onPress={onGenerate}>生成</Button>
)}
```

Use existing `useElapsedSeconds` / progress props already on main — do not invent a second timer. Keep 随机捏人 button on a non-primary accent (e.g. coral border/background classes), not forced to brand blue.

- [ ] **Step 3: Migrate browsers + dock + settings**

Pattern for each file:
1. Swap imports to `@heroui/react`
2. Replace `onClick` on those buttons with `onPress`
3. Replace `Dialog` with HeroUI `Modal` compound API (check installed types)
4. Run `npm run typecheck` after each file group
5. Commit per group

Suggested commits:
- `refactor: migrate composer and character-dock to HeroUI`
- `refactor: migrate pose/costume/face browsers to HeroUI`
- `refactor: migrate settings and remaining panels to HeroUI`

- [ ] **Step 4: Remove dead UI kit**

```bash
rg -n "components/ui" components app
# when empty:
git rm -r components/ui
# remove components.json if obsolete
npm uninstall @base-ui/react shadcn
# keep class-variance-authority / cn only if still referenced
```

- [ ] **Step 5: Commit cleanup**

```bash
git add -A components app package.json package-lock.json
git commit -m "refactor: drop shadcn/base-ui UI kit after HeroUI migration"
```

---

### Task 7: Plugin / harness parity

**Files:**
- Modify: `plugin/harness.css` only if extra `@source` paths needed for HeroUI
- Modify: `scripts/build-client.mjs` if CSS checks need updating
- Regenerate: `plugin/client.js` via `npm run build:client`

**Interfaces:**
- Consumes: same `Studio` tree as Web
- Produces: `plugin/client.js` that bundles HeroUI without forbidden requires

- [ ] **Step 1: Ensure harness CSS pulls HeroUI**

`plugin/harness.css` already starts with `@import "../app/globals.css";`. After Task 2, that includes `@heroui/styles`. Confirm PostCSS/`@source` still scans `components/**/*`.

If HeroUI classes are purged, add explicit sources per Tailwind v4 docs, e.g. in `app/globals.css` or harness:

```css
@source "../node_modules/@heroui/react/dist/**/*.{js,mjs}";
```

(Only if class purge is observed — verify before adding.)

- [ ] **Step 2: Build client**

```bash
npm run build:client
```

Expected: writes `plugin/client.js`; no error about unexpected `require` modules; no missing Outfit / `@container studio` checks.

- [ ] **Step 3: Run full test script**

```bash
npm test
```

Expected: existing shared tests + `studio-layout` PASS; `build:client` succeeds.

- [ ] **Step 4: Commit**

```bash
git add plugin/client.js plugin/harness.css scripts/build-client.mjs app/globals.css
git commit -m "fix: bundle HeroUI styles into DeepSeek Harness client"
```

---

### Task 8: Verification checklist (Web + plugin)

**Files:** none required (manual / browser)

- [ ] **Step 1: Web smoke (`npm run dev`)**

Checklist (all must pass):
1. Default layout is C after clearing `localStorage`.
2. Layout menu top-right lists A/B/C/D; each rearranges without clearing pose/costume/face.
3. Reload restores last layout.
4. Switch 姿势/服装/脸; filters scroll with page; pose angle thumbs switch on hover.
5. Generate shows `正在生成 · Ns` and 停止 stays visible; Stop aborts.
6. Result image click zooms.
7. 随机捏人 visible with non-primary accent.
8. Settings open via HeroUI modal/drawer; Comfy/key errors stay inline.

- [ ] **Step 2: Plugin smoke**

Run harness preview if available (`npm run` / `scripts/harness-preview.mjs` as documented in README), or load built client in Harness. Confirm same layout menu + selection persistence inside the panel shadow root.

- [ ] **Step 3: Open PR (do not merge)**

```bash
git push -u origin cursor/lanzi-heroui-studio
gh pr create --title "Rebuild Lanzi studio with HeroUI and switchable layouts" --body "$(cat <<'EOF'
## Summary
- Introduce StudioShell with layouts A–D (default C, `lanzi.studio.layout`)
- Migrate Web + DeepSeek Harness plugin UI to `@heroui/react`
- Preserve generate/provider contracts and selection state across layout switches

## Test plan
- [ ] Web: layouts A–D + localStorage
- [ ] Web: generate/stop busy copy
- [ ] Plugin: `npm run build:client` + panel smoke

English first. 中文：HeroUI 一屏工作台 + 四套布局，Web 与插件同步。
EOF
)"
```

Do **not** merge, bump, or npm publish unless the user says so.

---

## Spec coverage self-check

| Spec item | Task |
|-----------|------|
| StudioShell + slots | 4–5 |
| Layouts A–D open + header-right menu | 4–5 |
| `lanzi.studio.layout` default C | 3, 5 |
| Selection preserved on layout switch | 5 |
| Web + plugin shared HeroUI | 2, 6, 7 |
| HeroUI mapping / brand blue | 2, 6 |
| Busy `正在生成 · Ns` + stop visible | 6 |
| Inline errors / fallback layout C | 3, 6 |
| Tests: layout helpers + smoke | 3, 7, 8 |
| No contract/timeout changes; no auto merge | Global + 8 |

## Placeholder / consistency notes

- HeroUI Dropdown/Modal compound prop names must be aligned to the installed package types in Task 4/6 (API drift is the main adjustment point).
- Prefer `shared/studio-layout.mjs` for node:test import consistency with the rest of `shared/*.test.mjs`.
- Preview/Timeline stubs in Task 5 are intentional minimal surfaces; polish visuals after structure works.
