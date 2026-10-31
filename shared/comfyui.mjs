import workflow from "./workflows/local-tryon.api.json" with { type: "json" }

export function dimensions(aspect = "3:4") {
  const sizes = { "1:1": [768, 768], "3:4": [672, 896], "4:3": [896, 672], "9:16": [576, 1024], "16:9": [1024, 576] }
  return sizes[aspect] || sizes["3:4"]
}

export function localPrompts({ pose, costume, extraPrompt = "", characterCount = 1, keepOutfit = true }) {
  const people = pose?.people > 1 ? "exactly two adult people, matching their positions and interaction in the pose reference; the main person matches the identity references, the other person is fully clothed" : "exactly one adult person, a single subject, no duplicate people"
  const action = pose ? `${pose.name}; ${pose.angle}; ${pose.category}` : "keep the original pose and framing"
  const half = pose?.system?.includes("半身")
  const framing = half ? "an upper-body portrait from head to waist, with head and both arms visible" : "a full-body portrait with head and feet visible"
  const identity = characterCount > 1 ? "All additional identity images show the same main person from different views. Preserve that person's identity, face, hair, body type and visual style." : "Preserve the main person's identity, face, hair, body type and visual style."
  const prompts = {
    outfit: `Edit <image1>: replace the main person's outfit with the complete outfit in <image2>. Match its colors, fabric, patterns, silhouette and accessories. Keep the original pose, face, hair, framing and background. ${identity} One image, no collage. ${extraPrompt}`,
    scaffold: `A studio image of ${people}, ${framing}, wearing a loose opaque long-sleeved neutral gray shirt and full-length opaque trousers, fully dressed. Pose and camera: ${action}. Follow the depth map for body positions and composition, natural anatomy, simple neutral background. ${extraPrompt}`,
    final: costume
      ? `Create one image of ${people}, ${framing}. Use <image1> only for pose and framing: ${action}. The main person's face and identity must precisely match the original in <image4>. Use <image2> for the person wearing the outfit. Dress the main person in the complete outfit from <image3>, accurately matching its colors, fabric, patterns, sleeves, neckline and silhouette. ${identity} Do not copy the scaffold's face or clothing. No collage, no text. ${extraPrompt}`
      : half
        ? `Create an upper-body portrait of ${people}, the exact same person in <image1>. Her face, facial features, hair, skin tone and visible clothes must precisely match <image1> and <image3>. Change her pose to match <image2>: ${action}. Keep her original clothing, including its colors, neckline, fabric and sleeves; do not copy the face or clothes from <image2>. Frame from head to waist with both hands visible, fully clothed, natural anatomy. ${identity} No collage, no text. ${extraPrompt}`
        : `Create a full-body portrait of ${people}. Use <image1> only for body pose and framing: ${action}. The face, identity, skin tone and hairstyle must match <image2>, not <image1>. Replace clothing on <image1> with the same outfit worn by the person in <image3>, matching the clothing, colors, fabric, sleeves and neckline. Do not copy clothes from <image1>. If the lower body is not visible in <image3>, add opaque full-length trousers or a long skirt appropriate to the outfit. Fully clothed. ${identity} Entire body and feet visible, natural anatomy. No collage, no text. ${extraPrompt}`,
  }
  if (!costume && !keepOutfit) prompts.final = `Create one image of ${people}, ${framing}. Use ${half ? "<image2>" : "<image1>"} only for the body pose: ${action}. Preserve the face, hair and identity from ${half ? "<image1>" : "<image2>"}. You may change the clothes according to the following description, keeping every person fully clothed in opaque clothing. ${identity} No collage, no text. ${extraPrompt}`
  return prompts
}

// Resolve literal switches before submission: ComfyUI validates even inactive branches.
export function activeGraph(source, output) {
  const graph = structuredClone(source)
  const resolve = (link, seen = new Set()) => {
    if (!Array.isArray(link)) return link
    const [id] = link
    if (seen.has(String(id))) throw new Error("工作流存在循环连接。")
    const node = graph[id]
    if (!node) throw new Error(`工作流连接的节点不存在：${id}`)
    if (node.class_type !== "ComfySwitchNode") return link
    const { switch: control, on_true, on_false } = node.inputs
    const enabled = Array.isArray(control) && graph[control[0]]?.class_type === "PrimitiveBoolean" ? graph[control[0]].inputs.value : control
    if (typeof enabled !== "boolean") throw new Error("工作流开关必须是布尔值。")
    return resolve(enabled ? on_true : on_false, new Set([...seen, String(id)]))
  }
  const result = {}
  const visiting = new Set()
  function visit(id) {
    if (visiting.has(id)) throw new Error("工作流存在循环连接。")
    if (result[id]) return
    const node = graph[id]
    if (!node) throw new Error(`工作流节点不存在：${id}`)
    visiting.add(id)
    for (const [key, value] of Object.entries(node.inputs)) {
      node.inputs[key] = resolve(value)
      if (Array.isArray(node.inputs[key])) visit(String(node.inputs[key][0]))
    }
    visiting.delete(id)
    result[id] = node
  }
  visit(String(output))
  return result
}

export async function buildLocalGraph({ files, pose, costume, aspectRatio, seed = 42, extraPrompt = "", keepOutfit = true, prefix = "tryon/lanpose" }) {
  if (!pose && !costume) throw new Error("至少启用换装或姿势。")
  const { graph, mapping: m } = structuredClone(workflow)
  const set = (slot, value) => { const [id, key] = slot; graph[id].inputs[key] = value }
  set(m.person, files.characters[0])
  set(m.garment, files.garment || files.characters[0])
  set(m.pose, files.pose || files.characters[0])
  for (const slot of m.outfitSwitches) set(slot, Boolean(costume))
  set(m.poseSwitch, Boolean(pose))
  const prompts = localPrompts({ pose, costume, extraPrompt, characterCount: files.characters.length, keepOutfit })
  set(m.outfitPrompt, prompts.outfit)
  set(m.posePrompt, prompts.scaffold)
  set(m.finalPrompt, prompts.final)
  if (!costume) {
    const finalInputs = graph[m.finalPrompt[0]].inputs
    delete finalInputs["images.image_4"]
    if (pose?.system?.includes("半身")) {
      finalInputs["images.image_1"] = [m.person[0], 0]
      finalInputs["images.image_2"] = m.poseReference
    }
  }
  for (const slot of m.seeds) set(slot, seed)
  set(m.prefix, prefix)
  const [width, height] = dimensions(aspectRatio)
  for (const slot of m.widths) set(slot, width)
  for (const slot of m.heights) set(slot, height)
  // Qwen edits inherit the first reference's dimensions; uploaded person images are fitted too.
  for (let i = 1; i < files.characters.length; i++) {
    const id = String(500 + i)
    graph[id] = { class_type: "LoadImage", inputs: { image: files.characters[i] } }
    graph[m.outfitPrompt[0]].inputs[`images.image_${i + 2}`] = [id, 0]
    graph[m.finalPrompt[0]].inputs[`images.image_${i + (costume ? 4 : 3)}`] = [id, 0]
  }
  return { graph: activeGraph(graph, m.output), output: String(m.output), prompts }
}
