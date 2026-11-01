# 澜姿 HeroUI 一屏工作台重构 — Design Spec

**Date:** 2026-11-01  
**Repo:** `gen-ai-pose-image`（Web Next studio + DeepSeek Harness 插件）  
**Status:** Approved in brainstorm; awaiting final user review of this doc before implementation plan

## Goal

对澜姿一屏出图工作台做一次信息架构大改，并用官方 `@heroui/react` 重建 UI 层；**Web 与插件同步迁移**（同源区域组件），仍保持单屏工作台，不拆成多页向导。

## Non-goals

- 不改 Seedream / ComfyUI 等生图契约与超时策略（Hobby `maxDuration` 等既有约束照旧）。
- 不在本阶段 bump npm / 发版 / 合无关已开 PR（#28/#29 等仍听用户指令）。
- 不引入多路由「工作室首页」；布局切换不是页面跳转。
- 不做与本 IA/HeroUI 无关的视觉花活或第三套设计系统。

## Architecture

1. **保留** Next 工作台与现有生图、姿势/服装/脸业务逻辑；UI 从 shadcn/base-ui 迁到 `@heroui/react`（项目已具备 React 19 + Tailwind v4 栈）。
2. **抽出 `StudioShell`**：顶栏（品牌、姿势/服装/脸分段入口、**布局菜单**、设置）+ 四套布局插槽；业务块做成可插拔区域，按布局 A/B/C/D 拼装，功能不拆。
3. **布局偏好**写入 `localStorage` 键 `lanzi.studio.layout`，缺省 `C`；切换只改排布，**不清**已选姿势/服装/脸/模特。
4. **插件同步**：DeepSeek Harness 插件与 Web **共用同一套** `StudioShell` 与区域组件；差异仅宿主壳（Harness 挂载、无 Next 路由）。插件不得延后单独迁 HeroUI。
5. **配色**：跟 HeroUI 默认主题，再按现有 `DESIGN.md` 做品牌蓝微调（`primary` `#2563eb`，模特栏 `rail` `#0f172a` 等）。

## Shared regions

| Region | Responsibility |
|--------|----------------|
| `Header` | 品牌、姿势/服装/脸切换入口、布局菜单（顶栏右侧）、设置 |
| `CharacterDock` | 左侧/轨内模特列表与选择 |
| `Library` | 当前库网格 + 筛选（姿势/服装/脸浏览器） |
| `WorkOrder` | 已选摘要、参数、生成/停止、忙态文案 |
| `Preview` | 成图/对照；可点放大 |
| `Timeline` | 仅布局 D：已选姿势 → 服装 → 脸串 + 生成 |

## Layouts A–D

同一套区域，只换 CSS grid / 插槽：

- **A · 成图居中**：左竖排姿势/服装/脸库入口 · 中大 `Preview` · 右 `CharacterDock` + 生成
- **B · 左素材右出图**：左 `Library`（分段切库）· 右 `Preview` + 参数 + 生成
- **C · 顶部分段 + 工作单（默认）**：顶栏切库 · 下左 `CharacterDock` · 中 `Library` · 右 `WorkOrder`（接近现状）
- **D · 剪辑台**：上左 `Library` + 上右大 `Preview` · 底栏 `Timeline` + 生成

四套全部对用户开放；入口为顶栏右侧按钮或菜单。

## HeroUI component mapping

| UI need | HeroUI (indicative) |
|---------|---------------------|
| 顶栏 / 布局菜单 | `Navbar` + `Dropdown`（姿势/服装/脸可用 `Tabs`） |
| 筛选芯片 / 系列 | `Button` `variant="flat\|bordered"` + `Select` |
| 姿势/服装/脸卡 | `Card` + `Image`；视角缩略图 **hover** 切换（非 click） |
| 模特栏 | 深色 `Card` / `ScrollShadow`（rail 色） |
| 生成 / 停止 | `Button` primary / danger 或 secondary |
| 随机捏人 | `Button`，强调色**不限**主蓝（可珊瑚等醒目色） |
| 设置 | `Modal` 或 `Drawer` |
| 忙态 | 短文案「正在生成 · Ns」+ `Spinner`；**不得挤掉「停止」** |
| 成图放大 | `Modal` lightbox 或等价 |

既有产品约束继续生效：姿势卡紧凑、标题单行省略、筛选随页滚动（不 sticky）、选脸后模特可选、成图可点放大等（见近期产品记忆，实现计划逐条对照）。

## Data flow

- **选择态**（姿势/服装/脸/模特/布局）集中在现有 studio store（或等价 context）。布局字段只读写 `layout` + `localStorage`，不重置素材选择。
- **生图**仍走现有 provider 链路（Seedream、浏览器直连 ComfyUI 等）。UI 只订阅 busy、elapsed 秒、结果图、错误文案；不在 UI 层另造超时策略。
- Web 与插件共享同一 store 契约；插件仅替换挂载壳。

## Errors and busy states

- 生成中：`正在生成 · Ns` + 可见「停止」。
- 超时 / Abort：沿用现有友好提示。
- ComfyUI / API Key 失败：设置或工作单内**行内**错误，不挡整屏。
- 布局偏好损坏或非法值：回退默认 `C`，并短暂 toast 一句。

## Testing (this phase)

- 布局 A–D：排布正确、选择态保留、`lanzi.studio.layout` 读写与缺省 `C`。
- HeroUI 关键路径：切库、选卡、生成/停止、成图放大、随机捏人可见且不挤停止。
- **Web 与插件各冒烟一遍**同路径。
- 不扩 Seedream/Comfy 契约单测；若回归坏了再补。

## Rollout

1. 落地本 spec → 写 implementation plan（`writing-plans`）。
2. 实现：`StudioShell` + 四布局 + HeroUI 主题 → 迁各 browser/dock/composer → 插件挂载对齐。
3. 预览验证后再谈合并；**不自动 merge / npm publish**。

## Open references

- 线框预览：`/workspace/lanzi-layout-ia-preview.html`（会话产物，非仓库必选）
- 视觉与色板源：`DESIGN.md`
