# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

一个人在浏览器里给角色出图：默认是社区鲸鱼娘「大肥鱼」的成年形象，也可以导入别的成年模特。同一套目录也会装进 DeepSeek Harness，由对话里的 Agent 搜索姿势和服装并出图。

## Product Purpose

澜姿把中文姿势图库和衣装集接到同一次生图里。使用者点选一个或多个姿势，可选一套没有人物的衣服，再生成仍是同一位成年角色的图。成功是：脸、发型、鲸耳和鲸尾还在，姿势和衣服换成所选的那一套。

## Positioning

姿势线稿只提供身体结构，服装图只提供衣服。角色身份来自参考图，不来自线稿里的空白身体，也不来自服装图里的人台。

## Operating Context

工作室在本地浏览器里用。姿势图按需读取 ai-pose-gallery，服装图按需读取衣装集。生图默认走火山方舟 Seedream，也可以换成 Gemini 或 OpenAI 兼容接口。密钥留在浏览器或服务器环境变量里，不进仓库。

## Capabilities and Constraints

- 288 组、1439 张姿势线稿，可多选。标准全身默认可见；性感系、双人缠绵，以及上半身里的大胆分类，要先确认才显示。
- 1407 套服装，一次选一套。春夏秋冬和派对默认可见；内衣、泳装、性感与成人向姿势共用确认开关。
- 默认模特是大肥鱼成年三视图，不是 Q 版，也不是 DeepSeek 官方吉祥物。可导入最多三张成年模特参考。
- 本仓库不收录姿势图和服装图文件。程序使用 MIT 许可；姿势、服装和设定图的来源与版权见 `shared/license.mjs`。
- 插件工具是 search_poses、search_costumes、generate_pose_images。

## Brand Commitments

产品名是澜姿。角色名是大肥鱼。界面用中文。工作室界面采用这类工具的普通做法：白底、蓝色主操作、圆角卡片、左侧深色模特栏。不再换成另一套视觉主题。

## Evidence on Hand

- 角色参考：`public/muse/dafeiyu-sheet.png`、`public/muse/dafeiyu-portrait.jpg`
- 姿势索引：`data/catalog.json`
- 服装索引：`data/costumes.json`
- 已生成的换装成图只作演示，不作为产品素材入库。

## Product Principles

- 先能选姿势、再能换装、再能出图，三步都留在同一屏。
- 成人向内容默认收着，打开前要明确确认。
- 角色保持成年。导入的参考图也按成年人处理。
- 图床和密钥都不写进仓库。
