export const PROJECT_LICENSE = {
  spdx: "MIT",
  copyright: "Copyright (c) 2026 wzc520pyfm",
  covers: "澜姿自己的程序：姿势工作室、DeepSeek Harness 插件、提示词组装和测试。",
}

export const THIRD_PARTY_NOTICES = [
  {
    id: "poses",
    title: "姿势线稿与中文译名",
    holder: "ギア",
    source: "https://github.com/anhao/ai-pose-gallery-zh",
    upstream: "https://ai-pose-gallery.pages.dev/",
    author: "https://x.com/giaaibusi",
    included: "本仓库只保存 288 组姿势的中文名称、分类和公开图地址，不附带线稿文件。页面按需读取 https://ai-pose-gallery.anhao.app 。",
    terms: "线稿和原始日文数据的著作权归ギア所有。Anhao 维护中文译名。该仓库的 MIT 许可只覆盖它自己的页面和脚本，不覆盖 img/、thumbs/ 与原始数据，上游也说明这些素材不得用于商业用途。把名称和地址收进澜姿，并不把原图的权利转成我们的 MIT 许可。",
  },
  {
    id: "costumes",
    title: "衣装集",
    holder: "ギア",
    source: "https://ai-costume-gallery.pages.dev/",
    included: "本仓库只保存 1407 套服装的编号和关键词，不附带服装图片。页面按需读取上述站点。",
    terms: "制作者是ギア。衣装集允许把这些图用作创作参考，包括编辑和商业作品中的参考；禁止再分发、转载或转售图像数据本身，原尺寸和加工后的图都一样。署名不是对方的要求，这里仍然注明来源。",
  },
  {
    id: "muse",
    title: "默认模特大飞鱼",
    holder: "TreapGoGo",
    source: "https://github.com/TreapGoGo/deepseek-whale-girl",
    included: "public/muse/dafeiyu-sheet.png 是该仓库的 dafeiyu-mature-character-sheet.png。public/muse/dafeiyu-portrait.jpg 是同一张设定图的界面裁切。",
    terms: "设定图来自社区仓库 TreapGoGo/deepseek-whale-girl，版权所有 (c) 2026 TreapGoGo，按该仓库的 MIT 许可使用。这是非官方社区形象，不代表深度求索。",
  },
]

export function licenseNotices() {
  const intro = [
    "数据来源与版权",
    "",
    `本 MIT 许可只覆盖${PROJECT_LICENSE.covers}`,
    "下面这些材料不因本文件而变成澜姿的作品，也不因此获得额外授权。",
    "",
  ]
  const blocks = THIRD_PARTY_NOTICES.map((notice) => [
    notice.title,
    `权利人：${notice.holder}`,
    `来源：${notice.source}`,
    notice.upstream ? `原站：${notice.upstream}` : "",
    notice.author ? `原作者：${notice.author}` : "",
    notice.included,
    notice.terms,
  ].filter(Boolean).join("\n"))
  const marks = "DeepSeek 是深度求索的商标。澜姿没有获得这项商标的使用许可。"
  return [...intro, blocks.join("\n\n"), "", marks].join("\n")
}
