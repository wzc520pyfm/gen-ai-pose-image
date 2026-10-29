const ANGLE_NOTE = {
  正面: "front view at chest height",
  斜侧: "three-quarter view",
  侧面: "strict side profile",
  俯视: "high angle, camera looking down",
  仰视: "low angle, camera looking up",
}

export function composePrompt({ character, poses, extraPrompt = "", keepOutfit = true, mode = "each" }) {
  const lines = [
    "根据参考图重绘指定角色。排在前面的参考图是角色，后面的参考图是姿势结构线稿。",
    "只从线稿提取身体姿态、重心、四肢位置和镜头角度。不要把线稿、关节圆、比例辅助线画进成图。",
    "",
    "角色（必须保持身份）：",
    character.prompt,
    "这是成年人物。禁止画成儿童、幼儿或青少年，脸和身体都用成人比例。",
    keepOutfit
      ? "必须保留角色参考图中的服装、发色、发型和配饰。不要换成裸露或内衣，也不要照抄线稿的空白身体。"
      : "可以按用户补充更换服装，但脸、发型、发色和年龄必须仍是同一位成年角色。",
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
