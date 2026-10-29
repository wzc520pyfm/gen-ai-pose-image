# 澜姿

DeepSeek Harness 插件，也是一个可以单独打开的姿势工作室。从 [ai-pose-gallery-zh](https://github.com/anhao/ai-pose-gallery-zh) 的 288 组、1439 张姿势线稿里选一个或多个姿势，生成同一位模特的图。

默认模特是 **澜**：按 DeepSeek 蓝白配色原创绘制的成年女性，约二十五岁，墨蓝长发、青色挑染、鲸鱼发夹、白色短西装。可以导入最多三张别的模特照片，用来替换脸和衣服。姿势图只提供身体姿态，默认不会把线稿里的空白身体画进成图。

姿势线稿不在这个仓库里。页面会按需读取公开图床 `https://ai-pose-gallery.anhao.app`。图片与原始数据的著作权归ギア所有，中文译名来自 Anhao 的图库。

## 本地工作室

需要 Node.js 22.19 或更新版本。

```bash
npm install
npm run dev
```

打开 [http://127.0.0.1:43123](http://127.0.0.1:43123)。

1. 在中间点选姿势，可以多选。标准全身是默认页；性感系和双人姿势需要明确打开「成人向」。
2. 左侧可以导入其他模特，或继续用澜。
3. 右上角「生图设置」里填写 Gemini 或 OpenAI 兼容接口的密钥。密钥只留在这台浏览器里。
4. 没有密钥时，右侧仍会写出每一张图的提示词，可以复制到已安装的 `dsh-image-gen` 里生图。

也可以不把密钥放进浏览器，启动前设置：

```bash
POSE_MUSE_API_KEY=你的密钥 npm run dev
```

Gemini 默认模型是 `gemini-2.5-flash-image`。OpenAI 兼容接口会先走 `images/edits` 把模特图和姿势线稿一起送去；接口不支持编辑时，会退回纯文生图，并在结果上说明参考图没有送出。

## 装进 DeepSeek Harness

在 Harness 使用的目录里执行，把路径换成这个仓库的位置：

```bash
dsh plugin --profile web add /path/to/dsh-pose-muse
```

重启对应 profile 后：

- 对话视图里多一个「姿势」页，可多选标准全身姿势并生图。
- Agent 可以使用 `search_poses` 和 `generate_pose_images`。
- 给进程设置 `POSE_MUSE_API_KEY` 后，工具会直接出图并挂到会话里。没有密钥时，工具返回写好的提示词，方便交给 `dsh-image-gen` 的 `generate_image` / `edit_image`。

成人向姿势默认不进搜索结果。只有明确要求时才给 `search_poses` 传 `include_adult: true`。

## 检查

```bash
npm test
npm run typecheck
```

## 许可

插件代码使用 Apache License 2.0。该许可不覆盖姿势线稿、译名数据和 DeepSeek 的商标。澜的参考图是为本项目原创绘制的。
