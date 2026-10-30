const ANGLE_NOTE = {
  正面: "front view at chest height",
  斜侧: "three-quarter view",
  侧面: "strict side profile",
  俯视: "high angle, camera looking down",
  仰视: "low angle, camera looking up",
}

export function composePrompt({ character, poses, extraPrompt = "", keepOutfit = true, mode = "each", costume = null }) {
  const lines = [
    costume
      ? "根据参考图重绘指定角色。第一张是角色，接着是没有人物的服装图，最后是姿势结构线稿。"
      : "根据参考图重绘指定角色。排在前面的参考图是角色，后面的参考图是姿势结构线稿。",
    "只从线稿提取身体姿态、重心、四肢位置和镜头角度。不要把线稿、关节圆、比例辅助线画进成图。",
    "",
    "角色（必须保持身份）：",
    character.prompt,
    "这是成年人物。禁止画成儿童、幼儿或青少年，脸和身体都用成人比例。",
    costume
      ? [
          "中间那张参考图只有衣服，没有人物。把角色换成这套衣服，包括颜色、层次、鞋袜和配饰。",
          `服装编号 ${costume.id}。描述：${costume.keywords}。`,
          character.id === "dafeiyu"
            ? "保留角色的脸、发型、发色、鲸耳和鲸尾。角色描述里的原服装，以及第一张参考图上的衣服，这次都不要保留。"
            : "保留角色的脸、发型、发色，以及参考图里已有的耳朵、角或尾巴。角色描述里的原服装，以及第一张参考图上的衣服，这次都不要保留。",
          "不要画出服装图里的人台、假人或空白身体。",
        ].join("\n")
      : keepOutfit
        ? "必须保留角色参考图中的服装、发色、发型和配饰。不要换成裸露或内衣，也不要照抄线稿的空白身体。"
        : character.id === "dafeiyu"
          ? "可以按用户补充更换服装，但脸、发型、发色、鲸耳、鲸尾和年龄必须仍是同一位成年角色。"
          : "可以按用户补充更换服装，但脸、发型、发色和参考图里的特征必须仍是同一位成年角色。",
    "",
    mode === "sheet"
      ? "把下列姿势画在同一张图里，每个姿势一格，格子之间留白，不要写文字："
      : "只画这一个姿势：",
  ]
  poses.forEach((pose, index) => {
    const camera = ANGLE_NOTE[pose.angle] ?? pose.angle
    lines.push(`${index + 1}. ${pose.name}。分类：${pose.category}。体系：${pose.system}。视角：${pose.angle}（${camera}）。`)
    if (pose.people > 1) {
      lines.push("   这是双人姿势。人数和相互位置必须匹配线稿。主角使用上面的角色；另一人画成服装完整的成年人物，面部从简。")
    }
  })
  const note = String(extraPrompt).trim()
  lines.push("")
  lines.push(`画面补充：${note || "干净棚拍，柔和日光，浅灰背景，完整上色插画。"}`)
  lines.push("不要水印，不要文字，不要画框外的说明。")
  return lines.join("\n")
}
