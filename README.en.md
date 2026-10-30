[中文](./README.md)

# Lanpose

A DeepSeek Harness plugin, and a pose studio you can open on its own. Pick one or more sketches from the 288 groups and 1,439 views in [ai-pose-gallery-zh](https://github.com/anhao/ai-pose-gallery-zh), then generate images of the same model.

The default model is **Dafeiyu** (大肥鱼): an adult community whale-girl, with long wavy blue hair, whale ears, and a blue whale tail, wearing a navy-and-white maid outfit. The reference is `dafeiyu-mature-character-sheet.png` from [TreapGoGo](https://github.com/TreapGoGo)'s [deepseek-whale-girl](https://github.com/TreapGoGo/deepseek-whale-girl). You can import up to three other model photos to replace the face and clothes. Pose sketches supply body posture only. By default, the blank body in the sketch is not drawn into the result.

The pose sketches are not in this repository. The page fetches them on demand from [ai-pose-gallery.anhao.app](https://ai-pose-gallery.anhao.app). The images and original data are copyrighted by [ギア](https://x.com/giaaibusi). The Chinese names come from [Anhao](https://github.com/anhao)'s gallery.

Costumes come from [ギア](https://x.com/giaaibusi)'s [COSTUME-DB-01](https://ai-costume-gallery.pages.dev/): 1,407 outfits, with no person in the pictures. The page fetches thumbnails on demand. This repository stores only ids and keywords. After you pick one, generation changes the clothes and keeps the face, hair, whale ears, and whale tail. Lingerie, swimwear, and the sexy category share the same switch as adult poses.

## Results

The same standing pose, “站立・对立式平衡・手扶腰”. The first image keeps the maid outfit. The second swaps in costume SPR-0001.

<p>
<img src="docs/result-pose.jpg" alt="Maid outfit kept: Dafeiyu generated from the standing pose" width="360">
<img src="docs/result-costume.jpg" alt="Costume change: the same pose in SPR-0001 spring clothes" width="360">
</p>

With “女孩坐・双手抱头后” selected and costume SPR-0045 applied, the result appears on the right.

![Lanpose studio: a pose and a costume selected, with the result on the right](docs/studio-live.jpg)

On a narrow screen the model sits in the top bar, categories become a dropdown, and the generate button stays at the bottom.

![Pose page at phone width](docs/studio-phone.jpg)

Costume categories wrap, and the card text stays on screen.

![Costume page at phone width](docs/studio-costumes.jpg)

Inside Harness, the sidebar item is 「澜姿 / 工作室」. Opening it shows the same studio: model, poses, costumes, generation settings, and the generate flow. A wide panel keeps the three columns; a narrow panel stacks them and leaves the generate button at the bottom.

![Studio inside Harness](docs/harness.jpg)

## Local studio

Node.js 22.19 or newer.

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

1. Select poses in the middle. You can select more than one. Standard full-body is the default page. Sexy and couple poses stay hidden until you turn on “成人向”.
2. Switch to Costumes to pick one outfit. Spring, summer, autumn, winter, and party are visible by default. Lingerie, swimwear, and sexy need “成人向”.
3. Import another model on the left, or keep Dafeiyu. After a costume is selected, “保持服装” steps aside for that outfit.
4. Fill in a Gemini or OpenAI-compatible key under Image settings at the top right. The key stays in this browser.
5. Without a key, the right side still writes a prompt for each image. Copy it into an installed `dsh-image-gen`. When a costume is selected, the reference order is character, outfit with no person, then pose sketch.

Seedream uses Volcengine Ark at `https://ark.cn-beijing.volces.com/api/v3`, default model `doubao-seedream-5-0-flash-260915`. It sends the model image, the optional costume image, and the pose sketch together. Gemini defaults to `gemini-2.5-flash-image`. An OpenAI-compatible API tries `images/edits` first. If the endpoint cannot edit, it falls back to text-to-image and says so on the result.

If the server already has a key, the browser can leave its key empty:

```bash
POSE_MUSE_PROVIDER=seedream \
POSE_MUSE_MODEL=doubao-seedream-5-0-flash-260915 \
POSE_MUSE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3 \
POSE_MUSE_API_KEY=your-key \
npm run dev
```

## Install into DeepSeek Harness

On a machine that already has DeepSeek Harness:

```bash
dsh plugin --profile web add gen-ai-pose-image
```

The package name is `gen-ai-pose-image`. Before it is published, or when you are changing the local code, replace the package name with the path to this repository.

After restarting that profile:

- The left sidebar gains 「澜姿 / 工作室」, next to Plugins and Automation tasks. Opening it shows the full studio: poses, costumes, the model, and image generation.
- The agent can call `search_poses`, `search_costumes`, and `generate_pose_images`. Pass a costume id as `costume_id` to change clothes.
- With `POSE_MUSE_API_KEY` set on the process, the tools generate images and attach them to the session. Without a key, they return the written prompts for `generate_image` / `edit_image` in `dsh-image-gen`.

Adult poses and adult costumes stay out of search results. Pass `include_adult: true` to `search_poses` or `search_costumes` only when that is explicitly requested.

## Checks

```bash
npm test
npm run typecheck
```

## License

Lanpose's own program is under the [MIT License](./LICENSE). Sources and their copyrights are written in [`shared/license.mjs`](./shared/license.mjs) and appended to the end of [`LICENSE`](./LICENSE).

This MIT license covers the program only. The authors and works below are marked separately. Images are fetched on demand and are not stored in the repository:

- Pose sketches and the original data are copyrighted by [ギア](https://x.com/giaaibusi). The work is [AI Pose Gallery](https://ai-pose-gallery.pages.dev/). Chinese names are maintained by [Anhao](https://github.com/anhao) in [ai-pose-gallery-zh](https://github.com/anhao/ai-pose-gallery-zh). The image host is [ai-pose-gallery.anhao.app](https://ai-pose-gallery.anhao.app). Upstream says these images are not for commercial use.
- Costume images are also from [ギア](https://x.com/giaaibusi)'s [COSTUME-DB-01](https://ai-costume-gallery.pages.dev/). The repository stores only ids and keywords.
- The [Dafeiyu](https://github.com/TreapGoGo/deepseek-whale-girl) character sheet is by [TreapGoGo](https://github.com/TreapGoGo), copyright (c) 2026 TreapGoGo, used under that repository's MIT license. It is a community character and does not represent DeepSeek.
- [DeepSeek](https://www.deepseek.com/) is a trademark of DeepSeek. This license does not grant that trademark.
