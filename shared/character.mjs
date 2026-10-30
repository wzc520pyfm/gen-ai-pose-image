import { getBuiltinModel } from "./builtin-models.mjs"

export const DEFAULT_CHARACTER = {
  id: "dafeiyu",
  name: "大肥鱼",
  title: "DeepSeek 鲸鱼娘 · 成年形象",
  ageNote: "成年女性",
  summary: "长波浪蓝发、鲸耳和蓝鲸尾。海军蓝与白色女仆装，白色褶边头饰，围裙上有小蓝鲸，背后是大白蝴蝶结。",
  prompt: [
    "角色名：大肥鱼，社区里的 DeepSeek 鲸鱼娘成年形象。参考图是她的成年三视图，不要画成 Q 版、幼态或儿童。",
    "成年女性，五官成熟，身高和身体比例都是成人，不是儿童或青少年。",
    "外貌：很长的波浪蓝发，发色从深蓝过渡到亮青，侧边有辫子和蓝色蝴蝶结，头顶有一缕呆毛。蓝色眼睛。头两侧是白色内里的蓝色鲸耳，身后有一条蓝色鲸尾。",
    "服装：海军蓝与白色的女仆装。白色褶边头饰，露肩白衬衫，黑色领结和蓝色宝石，深蓝色长袖短外套，金色纽扣，白色围裙上有一只小蓝鲸图案，背后系着大白蝴蝶结，深蓝色短裙带白色褶边，白色过膝袜配小蝴蝶结，深蓝色高跟玛丽珍鞋。",
    "画风：干净的动漫插画，成人身体比例。必须匹配参考图中的这个角色，不要换成白西装或其他人。",
  ].join("\n"),
}

export function characterForBuiltin(id) {
  const model = getBuiltinModel(id)
  if (!model || model.id === "dafeiyu") return DEFAULT_CHARACTER
  return {
    id: model.id,
    name: model.name,
    title: model.name,
    ageNote: "成年女性",
    summary: model.blurb,
    prompt: [
      `角色名：${model.name}。按第一张参考图里的这个人来画，不要画成大肥鱼，也不要换成别人。`,
      "成年女性，五官和身体比例都是成人，不是儿童或青少年。",
      `外貌以参考图为准：${model.blurb}`,
      "服装、发色、耳朵、角或尾巴都跟参考图一致。参考图里没有的特征不要加。",
      "画风：干净的动漫插画，成人身体比例。",
    ].join("\n"),
  }
}

export function characterFromUploads(count) {
  return {
    id: "upload",
    name: "导入的模特",
    title: "导入的模特",
    ageNote: "按参考图里的成年人物",
    summary: "用导入的图片锁定脸、体型和服装。",
    prompt: [
      "角色来自用户导入的参考图，不要换成默认的大肥鱼。",
      "保持参考图中的脸、年龄感、体型、发型和服装。",
      "把参考图中的人物画成成年人。如果年龄含糊，画成二十岁以上，不要画成儿童、Q 版或青少年。",
      count > 1 ? `角色参考图共 ${count} 张，是同一个人。` : "角色参考图只有一张。",
    ].join("\n"),
  }
}
