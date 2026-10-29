---
name: 澜姿
description: 白底、蓝色主操作、深蓝模特栏的姿势与服装出图工作台。
colors:
  page: "#f7f8fb"
  surface: "#ffffff"
  ink: "#1c2433"
  muted: "#5c6573"
  line: "#e4e7ec"
  primary: "#2563eb"
  primary-ink: "#f8fafc"
  rail: "#0f172a"
  rail-ink: "#e2e8f0"
  rail-muted: "#cbd5e1"
typography:
  body:
    fontFamily: "Outfit, WenQuanYi Micro Hei, PingFang SC, Noto Sans SC, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  title:
    fontFamily: "Outfit, WenQuanYi Micro Hei, PingFang SC, Noto Sans SC, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0em"
rounded:
  sm: "8px"
  md: "12px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "#1d4ed8"
    textColor: "{colors.primary-ink}"
  chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0px"
---

## Overview

**Creative North Star: "白天的出图工作台"**

澜姿给一个人在浏览器里选姿势、换一套衣服、生成仍是同一位成年角色的图。界面按这类工具的普通做法做：看一眼就知道左边是模特，中间是图库，右边是这次要画的内容。

白天、桌前、屏幕光。所以页面是浅的，蓝色只用来表示当前选择和主操作，左边一条深蓝栏放角色。

**Key Characteristics:**

- 一种无衬线字体，标题靠字重而不是另一套字体。
- 白卡片、细边框、轻阴影。
- 选中是蓝色描边加圆点标签。
- 顶栏一行放下名称、姿势/服装切换和设置。

## Colors

页面底是浅灰，卡片和顶栏是白。文字是近黑，次要说明是同一套蓝灰，不用暖灰去配深蓝栏。

主蓝用于生图按钮、当前分类和选中描边。深蓝只属于左边的模特栏，栏内文字是冷的浅色。

**The One Blue Rule.** 蓝色表示「现在选中」或「下一步动作」，不拿来做装饰。

## Typography

正文和标题共用 Outfit，中文落到文泉驿微米黑或苹方。标题用 600，正文用 400。编号和姿势名用同一套字体，不另加等宽字。

## Layout

桌面是三栏：模特、图库、工作单。图库在窄屏排在模特介绍前面，底部一条按钮去生图。顶栏固定 56px，名称和页签不换行；「装进 Harness」在窄屏收起，设置图标留下。

栏与栏之间用 1px 分割线。卡片网格间距 12px，区块间距大于标题和正文的间距。

## Elevation & Depth

卡片用细边框和很轻的阴影分开层次。选中态用蓝色描边和一圈淡蓝，不用投影堆叠。

## Shapes

卡片和按钮用 12px 圆角。筛选和「已选」标签用胶囊。模特照片同样是 12px 圆角，不另做画框。

## Components

- 顶栏：白底，左为标记和「澜姿」，中为姿势/服装分段控制，右为设置。
- 模特栏：深蓝底，名字、肖像、三视图、导入和保持服装。
- 图库卡片：白底，选中加蓝框。姿势卡片标视角，服装卡片标「换这套」。
- 工作单：已选姿势、可选服装、补充描述、蓝色生图按钮。
- 空状态、加载骨架和错误文案留在原处，不另做插画。

## Do's and Don'ts

### Do:

- **Do** 让选姿势、换装、出图留在同一屏。
- **Do** 用蓝色标出当前分类、已选卡片和生图按钮。
- **Do** 成人向分类在确认前保持可点但未展开。

### Don't:

- **Don't** 换成纸色、衬线大标题或另一套主题皮肤。
- **Don't** 在标题上方再加一行小标签。
- **Don't** 用等宽字装饰界面；编号跟正文用同一套字体。
