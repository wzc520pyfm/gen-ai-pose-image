# 澜姿库优先布局 A / B / D — Design Spec

**Date:** 2026-11-01
**Repo:** `gen-ai-pose-image` (Web Next studio + DeepSeek Harness plugin)
**Branch:** `cursor/lanzi-heroui-studio` (PR #31)
**Status:** Wireframe direction approved (“先这么做一版”). This document records that direction. It does not authorize a merge, version bump, or npm publish. Do not start implementation from the commit that adds this file until the spec is reviewed.

This spec **replaces the A / B / D region maps** in [`2026-11-01-lanzi-heroui-studio-design.md`](./2026-11-01-lanzi-heroui-studio-design.md). Where the two disagree about A, B, or D, this document wins. Layout C, the storage key, generate/provider contracts, and “Web and plugin move together” still hold.

## 目标 Goal

Redraw layouts A, B, and D so the pose / costume / face library is the stage, at the same completeness C already has, and so the workbench (work order, model details, and sometimes the preview) can collapse. The user rejected the current A/B/D shells: they rearrange empty columns and a pale “成图预览” placeholder, and they drop model switching on B and D.

Success looks like this:

- A, B, and D each mount the real library (search, filters, cards, empty, error, adult gate, custom references).
- A region that is on screen is a real studio region. A region that the layout hides is absent, not an empty bordered box.
- HeroUI v3 components carry the new chrome and the library cards. Button, Input, and Modal are not the whole kit.
- Switching layouts keeps the current pose, costume, face, model, prompt, and results.
- The DeepSeek Harness panel uses the same shell, the same state, and the same overlays as the Web studio.

## 非目标 Non-goals

- Do not redraw layout C’s information architecture. C stays header library switch, left model dock, center library, right work order, plus the existing narrow-panel “去生图” sheet.
- Do not add a fifth layout, a multi-page wizard, or a separate “gallery” route. Layout choice stays a shell arrangement.
- Do not copy [ai-pose-gallery](https://ai-pose-gallery.anhao.com/poses) or [ai-pose-gallery-zh](https://github.com/anhao/ai-pose-gallery-zh). Borrow the library-first idea only. Do not reuse their nav labels, dark gallery theme, prompt-studio form, counts chrome, or assets.
- Do not change Seedream, Gemini, OpenAI, or ComfyUI contracts, timeouts, or Hobby `maxDuration`.
- Do not bump npm, merge PR #31, or publish. Unrelated open PRs stay untouched.
- Do not persist overlay-open flags, and do not add a second `localStorage` key.
- Do not restyle the studio into the dark wireframe. The wireframes are structure sketches. Production color stays `DESIGN.md`: light page, white surfaces, primary `#2563eb`, rail `#0f172a`.

## 已定决策 Decisions locked with the wireframe

| Topic | Decision |
| --- | --- |
| Layout set | Keep A, B, C, D. Default remains C. |
| C | Baseline. Do not move its three columns. |
| A · 成图居中 | Narrow library rail + full library grid. Preview is a center focus panel that closes back to pure browse. Bottom recipe bar. |
| B · 左素材右出图 | Large left library, persistent right preview. Work order folds into a recipe strip and an expand drawer. Model strip stays visible and collapsed. |
| D · 剪辑台 | Full-screen library, closest to a poses browse page. Bottom floating recipe pill. Preview opens in a drawer or half-sheet and does not sit beside the grid. |
| Hidden regions | At most the workbench and the preview. The library is never hidden. A hidden region is unmounted. |
| Selection | One studio store. `changeLayout` only writes `lanzi.studio.layout`. |
| Plugin | Same components as Web. No follow-up plugin-only layout. |
| Theme | Light library. Rail color only on chrome that the wireframe draws as a dark bar (A’s rail, B’s model strip, the recipe bar / pill). |

## 与现状的差距 Why the current A / B / D fail

`components/studio-layouts.tsx` today:

- **A** is `72px | preview | 300px`. The 72px rail replaces the library, so the pose grid never mounts. The preview cannot be dismissed. The right column is the dock plus the full composer, which is the workbench the wireframe wants folded.
- **B** is library | preview + full composer. The library is real, but the composer is always open, there is no recipe strip, and `CharacterDock` is not mounted, so model switch, rename, and sheet import disappear.
- **D** is library | a large preview, with `TimelineBar` underneath. The preview competes with browse. `TimelineBar` only shows pose count, costume id, face id, and generate/stop. It is not the composer. The dock is absent.
- **C** is the three-column shell and is the completeness bar: real `PoseBrowser` / `CostumeBrowser` / `FaceBrowser`, real `CharacterDock`, real `Composer`.

`LayoutARail` and `TimelineBar` are raw buttons and count chips. Library cards in the browsers are hand-rolled `<article>` blocks. Those browsers already use HeroUI only for `Button`, `Input`, and `Modal`.

## 共享区域 Shared regions

Same region objects the shell already receives. A/B/D change **where** they mount, not the business components behind them.

| Region | Real component | Completeness bar |
| --- | --- | --- |
| Library | `PoseBrowser`, `CostumeBrowser`, or `FaceBrowser` for the current library | Search, category/section filters, angle or equivalent segments, card grid, selection, empty, error + retry, adult gate, custom references, attribution. Filters scroll with the grid (not sticky). Pose titles stay one line with ellipsis. Pose angle thumbs still change on hover and on focus, not only on click. |
| Preview | `PreviewPane` | Latest successful result, click opens the existing lightbox `Modal`. Honest empty copy when open and no image yet: “还没有成图。选好配方后点生图。” Download stays on the result inside the workbench, as today. |
| Workbench | `Composer` plus model details | Selected pose list, face and costume summaries, extra prompt, prompt preview, limit / run errors, history, generate and stop, random combo. Model details are the existing `CharacterDock` (switch, rename, delete, import, keep-outfit, sheet). |
| Recipe | New summary, not a second source of truth | Face, costume, and pose chips bound to the same selection handlers the composer uses. Expand, generate, and stop call the same functions as the composer. |

Recipe chip rules:

- One face chip: `脸 · {id}` when a face is selected, otherwise `保持原脸`.
- One costume chip: `服 · {id}` when a costume is selected, otherwise `保持服装` when keep-outfit is on, otherwise `未指定服装`.
- Pose chips: up to three `姿 · {title}`, then one `+N` chip. Zero poses renders `未选姿势`.
- `配方 {n}/3` counts a selected face, a selected costume, and a non-empty pose list as one point each.
- Activating a chip switches the library to that kind (脸 → faces, 服 → costumes, 姿 → poses) and does not clear the selection.
- A selected chip removes through `TagGroup` `onRemove` (`onClearFace`, `onClearCostume`, `onRemove(poseId)`). Placeholder chips are not removable.
- Overflow poses remove from inside the expanded composer, not from the `+N` chip.

Generate on the recipe uses the composer’s existing disable rule (no pose, unless ComfyUI local mode with a costume only; over the mode limit). While running, the recipe replaces the primary button with `Spinner`, the text `正在生成 · Ns`, and a danger `停止`. The stop control stays visible. The open composer shows the same trio; it does not replace the recipe’s stop button.

If the workbench drawer is closed, `runError` and `limitNote` each render once on the recipe bar as HeroUI `Alert`. The composer keeps its own inline error text when the drawer is open. Do not stack a second `Alert` on the bar while the drawer is open.

`随机组合` stays the coral outline button (not primary blue). Placement: A header trailing cluster; B and D recipe bars; C inside the composer, unchanged.

## 布局 A Layout A · 成图居中

Library fills the screen. Preview is optional and centered. The workbench is closed until the recipe asks for it.

```
┌ header: 澜姿 · 布局 A · 随机组合 · (no second settings gear) ─┐
├──┬────────────────────────────────────────────────────────────┤
│姿│  library header: search, category, angle chips             │
│服│  ┌ card ┐ ┌ card ┐ ┌ card ┐ ┌ card ┐                       │
│脸│  └─────┘ └─────┘ └─────┘ └─────┘                           │
│  │                                                            │
│设│                                                            │
├──┴────────────────────────────────────────────────────────────┤
│ [脸] [服] [姿 …]   配方 n/3   工作单              生图 / 停止   │  docked bar
└───────────────────────────────────────────────────────────────┘

Preview open: a centered card over a light scrim. Library stays visible
around it and is inert until the panel closes.
```

| Slot | Contents |
| --- | --- |
| Header | Brand, layout menu, `随机组合`, Harness and GitHub actions. Hide the header settings button on A so there is only one settings control. Do not render header library tabs. |
| Rail | 72px, rail color, full height of the library stage. The rail itself does not scroll. Vertical `Tabs`: `姿` / `服` / `脸`, bound to the shared `library` state. `设` is pinned to the bottom of the rail and calls the same handler as today’s header gear. |
| Stage | The real library for the selected tab. No preview column. |
| Preview | Unmounted until opened. Opens as a centered `Card` (max width `min(56rem, 70%)`, max height `min(70dvh, 40rem)`) with `CloseButton`, the real `PreviewPane`, and a translucent scrim. Scrim click and Escape close it. |
| Recipe | Docked full-width bar, rail-colored, safe-area padding. Variant `dock`. |
| Workbench | Closed. `工作单` opens `Drawer` `placement="bottom"`, max height `min(85dvh, 720px)`, with `Drawer.Handle`. |

Workbench drawer body, top to bottom:

1. `Disclosure` titled with the active model name, **collapsed by default**, containing `CharacterDock`.
2. The real `Composer`.

Opening the drawer does not clear selection. Closing it does not either.

Preview open rules:

- Entering A does not auto-open an empty preview.
- A new successful result opens the panel. Remember the dismissed result key. Closing the panel stays closed until a newer successful result arrives, or the user presses `看成图` on the recipe bar.
- `看成图` is on the recipe bar only while the panel is closed and a successful image exists. The overlay’s `CloseButton` is the dismiss control. Do not also put a settings button on the overlay.

Below the studio container’s 1024px breakpoint the rail stays 72px, the recipe bar wraps chips onto a second line, and the preview card becomes nearly full-bleed with a 12px margin. The bottom drawer is unchanged.

## 布局 B Layout B · 左素材右出图

The library is the wide column. The preview is the one persistent preview in A/B/D. The work order is not a second scrolling column.

```
≥1024 container
┌ header: 澜姿 · 布局 B · 设置 ─────────────────────────────────┐
├──────────────────────────────────────┬─────────────────────────┤
│ Tabs 姿势 | 服装 | 脸部               │                         │
│ filter chips                         │   PreviewPane           │
│ ┌card┐ ┌card┐ ┌card┐                 │                         │
│ └────┘ └────┘ └────┘                 ├─────────────────────────┤
│ ┌ model strip (collapsed) ─────────┐ │ [脸][服][姿]  工作单  生图│
└──────────────────────────────────────┴─────────────────────────┘

<1024 container, one column
library → collapsed model strip → PreviewPane → recipe strip
```

| Slot | Contents |
| --- | --- |
| Header | Brand, layout menu, settings, Harness and GitHub. No header library tabs. `随机组合` lives on the recipe strip, not the header. |
| Library column | `minmax(0, 1.4fr)`. In-column `Tabs` for 姿势 / 服装 / 脸部, then the real browser. |
| Model strip | Rail-colored row under the grid: `Avatar`, model name, expand chevron. `Disclosure` **collapsed by default**. Expanded body is `CharacterDock`, not a second model UI. |
| Preview column | `minmax(300px, 0.8fr)`, always mounted `PreviewPane` on a light paper ground (`#f7f4ee`). Empty state is the honest sentence, not a stub label and not a fake card grid. |
| Recipe | Variant `strip`, rail-colored, pinned to the bottom of the preview column (and to the bottom of the stack when the layout is one column). |
| Workbench | `Drawer`. `placement="right"` at ≥1024, `placement="bottom"` below that. Body is `Composer` only. The dock stays in the strip so it is not shown twice. |

The right-hand drawer is a partial width (about 400px, max `100%`) so the library remains the large region beside it on a wide container. On a narrow container the bottom drawer covers at most `min(85dvh, 85%)`.

## 布局 D Layout D · 剪辑台

Browse is the whole stage. Nothing sits in a permanent preview column.

```
┌ header: 澜姿 · 布局 D · 设置 ─────────────────────────────────┐
│ 动作姿势库 / 服装库 / 脸部库                                    │
│ group chips · search · angle chips                            │
│ ┌card┐ ┌card┐ ┌card┐ ┌card┐ ┌card┐                            │
│                                                                │
│              ╭ [脸] [服] [姿]  工作单  看成图  生图 ╮            │  floating pill
└───────────────────────────────────────────────────────────────┘

看成图 → right drawer ≥1024, bottom half-sheet below that
工作单 → bottom drawer (same body as A)
```

| Slot | Contents |
| --- | --- |
| Header | Brand, layout menu, settings. No header library tabs. |
| Stage | Real library, full width. A layout-owned horizontal `Tabs` row (姿势 / 服装 / 脸部) sits above the browser and writes the shared `library` state. The browsers do not grow their own copy of that switch. Under the tabs, the heading is `动作姿势库`, `服装库`, or `脸部库`. Category, search, and angle controls stay inside the browser and scroll away with the grid. |
| Recipe | Variant `pill`: rail-colored, horizontally centered, `rounded-full`, shadow, inset from the edges, above the grid (`z` above cards). Not a full-bleed footer. Library content has bottom padding so the last row clears the pill. The pill does not hide on scroll. Include safe-area inset. |
| `看成图` | On the pill, always. It opens the preview even when there is no image yet (honest empty state). |
| Preview | Unmounted until opened. ≥1024: `Drawer` `placement="right"`, width `min(440px, 100%)`, containing `PreviewPane`. Below 1024: `Drawer` `placement="bottom"` with `Drawer.Handle`, max height `70dvh`. |
| Workbench | Same bottom drawer as A (collapsed model `Disclosure`, then `Composer`). |

Auto-open the preview drawer on a new successful result, with the same dismissed-result-key rule as A.

On a narrow container, opening the preview drawer closes the workbench drawer, and opening the workbench closes the preview. Two bottom sheets must not stack. At ≥1024 they may both be open: preview on the right, workbench from the bottom.

`TimelineBar` is retired. D does not keep a pose-count strip that omits removal, prompt, history, and the dock.

## 布局 C Layout C · 不改信息架构

Leave this grid alone:

- Header library switch, then left `CharacterDock`, center library, right `Composer` from `@min-[1024px]/studio`.
- Below that breakpoint, keep today’s bottom `去生图` trigger and bottom `Sheet` that mounts `Composer`. Do not add the A/B/D recipe bar on C.
- Do not mount `PreviewPane` as a C column. Results stay in the composer, as now.
- The header still shows the current face id and costume id when they fit.

Use one shared set of library widgets, including on C: HeroUI `Card`, `Chip`, `SearchField`, `Select`, `ToggleButtonGroup`, and `Skeleton`. C’s card chrome may change. C’s column order, the set of filters, and hover-to-change-angle stay as they are. Do not fork a second card implementation for A/B/D.

When the layout is A, B, or D, do not render C’s `mobileWorkOrderTrigger`. Two bottom bars are a defect.

## 工作台收起与展开 Workbench hide and expand

| Layout | Always visible | Collapsed but present | Unmounted until asked |
| --- | --- | --- | --- |
| A | Library, recipe dock, rail | — | Preview panel, workbench drawer (composer + dock) |
| B | Library, preview, recipe strip, model strip | Model-strip details | Workbench drawer (composer only) |
| D | Library, recipe pill | — | Preview drawer, workbench drawer (composer + dock) |
| C | Dock, library, work order (work order via sheet when narrow) | — | No A/B/D overlays |

“Asked” means the recipe control, `看成图`, a new successful result (preview only, A and D), or expanding the model disclosure (B).

Chrome flags (`previewOpen`, `workbenchOpen`, `modelStripOpen`, `dismissedResultKey`) are React state on the studio frame, keyed by layout id, memory only. Switching A → B → A restores A’s flags. Switching layout closes nothing in the selection store. Defaults on first visit: every overlay closed, B’s disclosure closed.

Generate from the recipe while the drawer is closed stays closed. A failure is visible on the recipe bar. A success on A or D opens the preview and leaves the workbench closed.

## HeroUI 组件映射 HeroUI component mapping

Package already on the branch: `@heroui/react` and `@heroui/styles` `^3.2.7`. Do not bump. HeroUI v3 rules already in force: no `HeroUIProvider`; compound slots (`Card.Header`, `Tabs.Tab`, `Drawer.Dialog`); `Button` uses `onPress`; styles stay `@import "tailwindcss"` then `@import "@heroui/styles"`.

Use these v3 components for the new surfaces. A hand-rolled `<button class="rounded-full">` that duplicates `Chip`, `Tabs`, or `Tag` does not meet the bar.

| UI need | HeroUI v3 |
| --- | --- |
| A rail 姿 / 服 / 脸 | `Tabs` `orientation="vertical"` `align="start"`, `Tabs.List` / `Tabs.Tab` / `Tabs.Indicator` |
| B in-column library switch, C header switch | `Tabs` horizontal. C’s three header buttons become this, in the same header slot. |
| D library switch, above the browser | Same horizontal `Tabs` as B. Not a control inside `PoseBrowser`. |
| Angle / section filter segments | `ToggleButtonGroup` single-select. These filter the grid; they are not `Tabs` panels. |
| Category filter | `Select` |
| Library search | `SearchField` |
| Pose, costume, and face cards | `Card`, `Card.Header`, `Card.Title`, `Card.Description`, `Card.Footer` |
| “已选” on a card | `Chip` `color="accent"` `size="sm"` |
| Recipe chips | `TagGroup` with `onRemove`, `Tag`, optional `Avatar` thumb. Omit remove on placeholder chips. |
| Recipe / rail chrome | Rail-colored `Surface` |
| A focus preview | `Card` wrapping `PreviewPane` |
| B model strip | Rail-colored `Surface` wrapping `Disclosure` |
| B model details, A/D model block | `Disclosure` controlled with `isExpanded` / `onExpandedChange`. Slots: `Disclosure.Heading`, `Disclosure.Trigger`, `Disclosure.Indicator`, `Disclosure.Content`. Body is `CharacterDock`. Default collapsed. |
| Workbench and D preview | `Drawer`, `Drawer.Backdrop`, `Drawer.Content`, `Drawer.Dialog`, `Drawer.Handle` on bottom placement, `Drawer.CloseTrigger`, `Drawer.Header`, `Drawer.Body` |
| Dismiss preview card (A) | `CloseButton` |
| Generate / stop / settings / 看成图 | `Button` (`primary`, `danger`, `secondary`, `outline`) |
| Busy | `Spinner` `size="sm"` next to `正在生成 · Ns` |
| Closed-drawer errors | `Alert`, hidden while the workbench drawer is open |
| Loading grid | `Skeleton` |
| Long library and drawer body | `ScrollShadow` |
| Layout menu, settings, lightbox, adult confirm | Keep `Dropdown` and `Modal` as they are |
| C narrow work order | Keep the existing `Sheet`. Do not convert C to `Drawer` in this work. |
| Dividers inside the drawer | `Separator` |

Do not introduce HeroUI v2 names (`Navbar`, `useDisclosure` from v2). Icons may stay `lucide-react`, matching the shell.

Card adoption keeps today’s information: image, one-line title, category, angle thumb row, “看线稿” preview, selected state. Hover still swaps the large angle. Do not add the wireframe’s literal “Card” or “+ 加入” placeholder labels. The card’s primary press still toggles selection the way the browser does now; D does not invent a different add model.

## 持久化 Persistence

Unchanged helpers in `shared/studio-layout.mjs`:

- Key: `lanzi.studio.layout`
- Allowed values: `A` `B` `C` `D`
- Missing, illegal, or throwing storage reads return `C`
- `saveStudioLayout` writes the normalized id only

`changeLayout` in `components/studio.tsx` may set that id and nothing else. These survive a layout switch because they already live on the studio frame, and they must keep doing so:

- selected poses (`poseId → viewId`)
- costume, face, active model, keep-outfit
- extra prompt, settings, history
- in-flight generate / abort controller and elapsed seconds
- result list
- current library (`poses` | `costumes` | `faces`)

Illegal layout values do not toast. The current helper is silent; leave it that way.

Do not store preview-open, drawer-open, or disclosure-open state.

## 插件对齐 Plugin parity

`plugin/harness-entry.tsx` mounts the same `Studio` with `embedded` and a shadow-root `portalContainer`. A/B/D ship in that bundle. There is no plugin-specific grid.

Requirements:

- The Harness panel is often narrower than the browser window. Breakpoints use the existing `@container/studio` queries (`@min-[1024px]/studio`), not viewport media queries, so a narrow panel stacks B and uses D’s half-sheet on a wide monitor.
- `Drawer`, `Modal`, `Popover`, `Tooltip`, and `Select` popovers must portal into `useStudioEnv().portalContainer` when it is non-null. Web passes null and keeps the default document portal. An overlay that opens on `document.body` outside the shadow root is unstyled and fails parity.
- The shadow CSS bundle that already inlines HeroUI styles must include whatever new component CSS this work pulls in. No second plugin stylesheet.
- Harness client externals stay `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`.
- Smoke the same path on Web and in the built plugin panel: switch library, select a card, switch layout, confirm the selection is still there, open the workbench, open preview, generate/stop affordance visible.

`portalContainer` is already threaded into `StudioEnvProvider` and is not yet read by overlays. This work has to consume it. Do not invent a second portal prop.

## 从占位布局迁出 Migration from the current stubs

Touch layout composition and the shared widgets listed here. Do not regenerate providers or the selection store.

| Current | Becomes |
| --- | --- |
| `StudioLayoutGrid` branch A (`72px / preview / 300px`) | Rail + library stage + docked recipe. Preview is an overlay sibling, not a grid column. |
| Branch B (library / preview+composer) | Library column including the model disclosure, preview column, recipe strip. Composer moves into the drawer. |
| Branch D (library / preview + `TimelineBar`) | Full-bleed library + floating pill. Delete the side-by-side preview. |
| Branch C | Unchanged grid. |
| `LayoutARail` raw buttons | Vertical `Tabs`. Keep the component only if it becomes that tabs rail. |
| `TimelineBar` | Remove once the recipe bar owns generate, stop, and chips. |
| Header `libraryTabs` raw tablist | HeroUI `Tabs`, rendered only when `layout === "C"`. |
| `mobileWorkOrderTrigger` | Render only when `layout === "C"`. |
| Pose / costume / face card articles and filter `<select>` / search `<input>` | HeroUI mapping above, same handlers. |
| New recipe bar | One component, variants `dock` (A), `strip` (B), `pill` (D). |
| New workbench drawer | One component. A and D include the collapsed dock disclosure. B does not. |

Suggested files for the later plan (not this commit): `components/studio-layouts.tsx`, `components/studio-shell.tsx`, `components/studio-preview.tsx`, `components/studio.tsx`, `components/pose-browser.tsx`, `components/costume-browser.tsx`, `components/face-browser.tsx`, new recipe and workbench components, `components/studio-timeline.tsx` removal, and a portal hook beside `lib/studio-env.tsx`. Tests to extend: layout switch does not clear selection (studio frame), recipe chip remove calls the existing clear handlers, illegal layout still falls back to C (`shared/studio-layout.test.mjs` already covers the helper).

Acceptance for that later implementation:

1. A shows a real pose grid with the rail on 姿. Closing the preview leaves that grid and no empty preview column.
2. B shows the grid and a persistent `PreviewPane`, a collapsed model strip that expands into the real dock, and a composer that appears only in the drawer.
3. D shows no side-by-side preview. `看成图` opens a drawer or half-sheet. The pill remains reachable over the last row of cards.
4. Each visible library can search, filter, empty, and error. Pose hover still changes angle.
5. Select a pose, costume, and face on A, switch B → D → C → A, and the same three are selected. `localStorage["lanzi.studio.layout"]` is `A`.
6. Generate control disables with no selection, and while running shows `正在生成 · Ns` plus `停止` on the recipe bar.
7. C’s three columns and the narrow “去生图” sheet still behave as they do on this branch.
8. Web and the built Harness client both open the workbench drawer inside their own document or shadow root.

## 参考什么、不抄什么 Inspiration boundary

Useful patterns from the public poses page and studio page, and from `anhao/ai-pose-gallery-zh`:

- The library is the product: dense card grid, category chips, search, a quiet count.
- The generation workbench is a second surface (their studio page), not a column that must stay open while browsing.

Lanzi already has its own catalogs, adult gate, custom references, model dock, and provider settings. Keep those. Do not port their page structure, dark theme, English/Chinese gallery masthead, prompt blocks, or model-id form.

## 开放问题 Open questions

None that block the first implementation. One check before coding, because the approved pictures are dark and this spec is not:

- If those dark panels were meant as the production theme, stop and say so. This spec treats them as information architecture and keeps the light `DESIGN.md` studio, with `#0f172a` only on the A rail, the B model strip, and the recipe bar or pill.
