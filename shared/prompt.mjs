const ANGLE_NOTE = {
  正面: "front view at chest height",
  斜侧: "three-quarter view",
  侧面: "strict side profile",
  俯视: "high angle, camera looking down",
  仰视: "low angle, camera looking up",
}

function referenceOrder({ characterCount, costume }) {
  const count = Math.max(1, Number(characterCount) || 1)
  const parts = [count === 1 ? "第 1 张是角色" : `前 ${count} 张是同一角色`]
  let index = count + 1
  parts.push(`第 ${index} 张是脸部参考，只取五官、表情、脸型和发型`)
  index += 1
  if (costume) {
    parts.push(`第 ${index} 张是没有人物的服装图`)
    index += 1
  }
  parts.push(`从第 ${index} 张起是姿势结构线稿`)
  return `根据参考图重绘指定角色。${parts.join("，")}。`
}

function faceLines(face, character) {
  const bits = [face.section, face.hair, face.label].filter(Boolean)
  const ears = character.id === "dafeiyu"
    ? "鲸耳要长在这张脸上，鲸尾仍按角色参考保留。脸部参考里没有鲸耳或鲸尾，不要因此把它们去掉。"
    : "角色参考里已有的耳朵、角或尾巴仍然保留。脸部参考里没有这些特征，不要因此去掉。"
  return [
    `脸部参考编号 ${face.id}。${bits.length ? `描述：${bits.join("，")}。` : ""}`,
    "把这张图只当作脸部和表情参考：五官、脸型、骨相、表情和发型与它一致。",
    "不要把脸部参考图里的衣服、身体、背景或画框画进成图。",
    ears,
  ].join("\n")
}

function outfitLines({ character, costume, keepOutfit, face }) {
  if (costume) {
    const identity = character.id === "dafeiyu"
      ? face
        ? "保留角色的鲸耳和鲸尾。角色描述里的原服装，以及第一张参考图上的衣服，这次都不要保留。"
        : "保留角色的脸、发型、发色、鲸耳和鲸尾。角色描述里的原服装，以及第一张参考图上的衣服，这次都不要保留。"
      : face
        ? "保留参考图里已有的耳朵、角或尾巴。角色描述里的原服装，以及第一张参考图上的衣服，这次都不要保留。"
        : "保留角色的脸、发型、发色，以及参考图里已有的耳朵、角或尾巴。角色描述里的原服装，以及第一张参考图上的衣服，这次都不要保留。"
    return [
      face
        ? "服装参考图只有衣服，没有人物。把角色换成这套衣服，包括颜色、层次、鞋袜和配饰。脸、表情、发色和发型以脸部参考为准。"
        : "中间那张参考图只有衣服，没有人物。把角色换成这套衣服，包括颜色、层次、鞋袜和配饰。",
      `服装编号 ${costume.id}。描述：${costume.keywords}。`,
      identity,
      "不要画出服装图里的人台、假人或空白身体。",
    ].join("\n")
  }
  if (keepOutfit) {
    return face
      ? "必须保留角色参考图中的服装和配饰。脸、表情、发色和发型改用脸部参考，不要照抄角色参考图上的脸。"
      : "必须保留角色参考图中的服装、发色、发型和配饰。不要换成裸露或内衣，也不要照抄线稿的空白身体。"
  }
  if (character.id === "dafeiyu") {
    return face
      ? "可以按用户补充更换服装。脸、表情和发型改用脸部参考。鲸耳、鲸尾和年龄必须仍是同一位成年角色。"
      : "可以按用户补充更换服装，但脸、发型、发色、鲸耳、鲸尾和年龄必须仍是同一位成年角色。"
  }
  return face
    ? "可以按用户补充更换服装。脸、表情和发型改用脸部参考。参考图里的耳朵、角或尾巴，以及年龄，必须仍是同一位成年角色。"
    : "可以按用户补充更换服装，但脸、发型、发色和参考图里的特征必须仍是同一位成年角色。"
}

export function composePrompt({ character, poses, extraPrompt = "", keepOutfit = true, mode = "each", costume = null, face = null, characterCount = 1 }) {
  const lines = [
    face
      ? referenceOrder({ characterCount, costume })
      : costume
        ? "根据参考图重绘指定角色。第一张是角色，接着是没有人物的服装图，最后是姿势结构线稿。"
        : "根据参考图重绘指定角色。排在前面的参考图是角色，后面的参考图是姿势结构线稿。",
    "只从线稿提取身体姿态、重心、四肢位置和镜头角度。不要把线稿、关节圆、比例辅助线画进成图。",
    "",
    "角色（必须保持身份）：",
    character.prompt,
    ...(face ? [character.id === "dafeiyu"
      ? "角色描述里关于脸、发色和发型的句子，这次让位给脸部参考。年龄、鲸耳和鲸尾仍然有效。"
      : "角色描述里关于脸、发色和发型的句子，这次让位给脸部参考。年龄，以及参考图里的耳朵、角或尾巴，仍然有效。"] : []),
    "这是成年人物。禁止画成儿童、幼儿或青少年，脸和身体都用成人比例。",
    ...(face ? [faceLines(face, character)] : []),
    outfitLines({ character, costume, keepOutfit, face }),
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
