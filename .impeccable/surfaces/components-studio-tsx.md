---
version: 1
slug: "components-studio-tsx"
primary_target: "components/studio.tsx"
related_targets: ["components/composer.tsx","components/character-dock.tsx","components/pose-browser.tsx","components/costume-browser.tsx"]
---

# 澜姿工作室

范围：浏览器里的姿势与服装工作室。模式：Operate。

使用者在同一屏完成选姿势、可选一套衣服、出图。不动的部分：中文、大肥鱼、成人向确认、导入模特、生图设置。

## Direction contract

THESIS: 这是一张白天在浏览器里用的出图工作台。顶栏放名称和姿势/服装切换，三栏分别是模特、图库和工作单。拒绝纸色衬线，也拒绝把界面做成邮票册、夜市或年鉴。

OWN-WORLD: 页面是白和浅灰。主操作和选中态用蓝。左边模特栏是深蓝。圆角卡片，一种无衬线字体。选中用蓝色描边和圆点标签。

STORY: 打开就能点姿势或衣服，右边看见已选内容和生图按钮。成人向内容在确认前不出现。

FIRST VIEWPORT: 高 56px 的白顶栏，左上是标记和「澜姿」，接着是「姿势 / 服装」分段控制，右上是装进 Harness 和设置。下面三栏：深蓝模特栏、白色图库、白色工作单。主操作是工作单底部的蓝色「按所选姿势生图」。

FORM: 用户选择的普通做法，也就是这类工具的标准界面，不在七个自拟方向里。seed:815100a951621b71

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
