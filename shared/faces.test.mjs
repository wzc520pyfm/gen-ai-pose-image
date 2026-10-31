import assert from "node:assert/strict"
import sharp from "sharp"
import { test } from "node:test"
import { buildLocalGraph, localPrompts } from "./comfyui.mjs"
import { DEFAULT_CHARACTER } from "./character.mjs"
import { fetchFaceBytes, getFace, getFaceCatalog, isSafeFacePath, searchFaces } from "./faces.mjs"
import { planRequest, referenceImages, runGeneration } from "./jobs.mjs"
import { licenseNotices } from "./license.mjs"
import { composePrompt } from "./prompt.mjs"

const FACE_ID = "f009cba9893"

test("face catalog keeps the public portrait sections and hair lengths", () => {
  const catalog = getFaceCatalog()
  assert.equal(catalog.total, 1499)
  assert.equal(catalog.faces.length, 1499)
  assert.equal(catalog.license, "CC0-1.0")
  assert.equal(catalog.origin, "https://ai-portrait-gallery.pages.dev")
  assert.equal(catalog.author, "https://x.com/giaaibusi")
  assert.deepEqual(catalog.sections.map((item) => [item.id, item.count]), [["脸部特写", 893], ["造型", 606]])
  assert.deepEqual(catalog.hairs.map((item) => item.count), [727, 376, 260, 136])
  const face = getFace(FACE_ID)
  assert.equal(face.section, "脸部特写")
  assert.equal(face.hair, "短发")
  assert.equal(face.thumb, `img/thumb/${FACE_ID}.webp`)
  assert.equal(face.full, `img/full/${FACE_ID}.png`)
  assert.equal(getFace("missing"), undefined)
})

test("face search filters section, hair length, and Chinese or Japanese labels", () => {
  const closeups = searchFaces({ section: "脸部特写", hair: "短发", limit: 20 })
  assert.equal(closeups.length, 20)
  assert.ok(closeups.every((face) => face.section === "脸部特写" && face.hair === "短发"))
  const styled = searchFaces({ query: "内收短发", section: "造型", limit: 10 })
  assert.equal(styled.length, 0)
  const named = searchFaces({ query: "くびれショート", limit: 5 })
  assert.ok(named.some((face) => face.id === FACE_ID))
  assert.equal(searchFaces({ hair: "长发", section: "造型", limit: 120 }).every((face) => face.hair === "长发" && face.section === "造型"), true)
  assert.equal(isSafeFacePath(getFace(FACE_ID).full), true)
  assert.equal(isSafeFacePath(getFace(FACE_ID).thumb), true)
  assert.equal(isSafeFacePath("../.env"), false)
  assert.equal(isSafeFacePath("img/full/not-a-face.png"), false)
})

test("a selected face is applied without dropping pose or costume instructions", () => {
  const face = getFace(FACE_ID)
  const poses = [{ name: "站立", category: "站姿", system: "全身单人・标准系", angle: "正面", people: 1 }]
  const text = composePrompt({
    character: DEFAULT_CHARACTER,
    poses,
    keepOutfit: true,
    face: { id: face.id, section: face.section, hair: face.hair, label: face.label },
  })
  assert.match(text, new RegExp(`脸部参考编号 ${FACE_ID}`))
  assert.match(text, /第 2 张是脸部参考/)
  assert.match(text, /从第 3 张起是姿势结构线稿/)
  assert.match(text, /鲸耳要长在这张脸上/)
  assert.match(text, /必须保留角色参考图中的服装和配饰/)
  assert.doesNotMatch(text, /必须保留角色参考图中的服装、发色、发型和配饰/)
  const dressed = composePrompt({
    character: DEFAULT_CHARACTER,
    poses,
    costume: { id: "SPR-0001", keywords: "ivory frill knit" },
    face: { id: face.id, section: face.section, hair: face.hair, label: face.label },
  })
  assert.match(dressed, /第 2 张是脸部参考，只取五官、表情、脸型和发型，第 3 张是没有人物的服装图，从第 4 张起是姿势结构线稿/)
  assert.match(dressed, /原服装，以及第一张参考图上的衣服，这次都不要保留/)
  assert.match(dressed, /鲸尾/)
  assert.doesNotMatch(dressed, /保留角色的脸、发型、发色、鲸耳和鲸尾/)
  const plan = planRequest({ provider: "seedream", viewIds: ["full_single_P001"], faceId: FACE_ID, costumeId: "SPR-0001" })
  assert.equal(plan.face.id, FACE_ID)
  assert.match(plan.items[0].prompt, /脸部参考编号/)
  assert.match(plan.items[0].prompt, /服装编号 SPR-0001/)
  assert.throws(() => planRequest({ provider: "gemini", viewIds: ["full_single_P001"], faceId: "NO-SUCH" }), /找不到脸部参考/)
})

test("generation sends character, face, costume, then pose to every provider", async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } }).png().toBuffer()
  const webp = await sharp({ create: { width: 8, height: 8, channels: 3, background: "blue" } }).webp().toBuffer()
  const seen = []
  let facePath = ""
  await runGeneration({
    provider: "gemini",
    apiKey: "test-key",
    viewIds: ["full_single_P001"],
    costumeId: "SPR-0001",
    faceId: FACE_ID,
  }, {
    fetchPose: async () => ({ mediaType: "image/png", buffer: png, role: "pose" }),
    fetchCostume: async () => ({ mediaType: "image/webp", buffer: webp, role: "costume" }),
    fetchFace: async (path) => {
      facePath = path
      return { mediaType: "image/png", buffer: png, role: "face" }
    },
    generate: async ({ images, prompt }) => {
      seen.push({ roles: images.map((image) => image.role), prompt })
      return { mediaType: "image/png", buffer: png, referencesSent: true }
    },
  })
  assert.equal(facePath, `img/full/${FACE_ID}.png`)
  assert.deepEqual(seen[0].roles, ["character", "face", "costume", "pose"])
  assert.match(seen[0].prompt, /第 2 张是脸部参考/)
  assert.deepEqual(
    referenceImages({
      characterImages: [{ role: "character" }],
      faceImages: [{ role: "face" }],
      costumeImages: [{ role: "costume" }],
      poseImages: [{ role: "pose" }],
    }).map((image) => image.role),
    ["character", "face", "costume", "pose"],
  )
})

test("local workflow attaches the face original after the character slots", async () => {
  const face = { id: FACE_ID, section: "脸部特写", hair: "短发", label: "内收短发" }
  const pose = { name: "双手抬起", angle: "正面", category: "站姿", people: 1 }
  const prompt = localPrompts({ pose, costume: { id: "SPR-0001" }, face, characterCount: 1 })
  assert.match(prompt.final, /<image5> as the only face/)
  assert.doesNotMatch(prompt.final, /must precisely match the original in <image4>/)
  const { graph } = await buildLocalGraph({
    files: { characters: ["person.png"], garment: "clothes.png", pose: "pose.png", face: "face.png" },
    costume: { id: "SPR-0001" },
    pose,
    face,
    aspectRatio: "3:4",
  })
  assert.equal(graph["510"].inputs.image, "face.png")
  assert.equal(graph["207"].inputs["images.image_5"][0], "510")
})

test("face bytes stay remote and license credits ギア under CC0", async () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(64)])
  const image = await fetchFaceBytes(`img/thumb/${FACE_ID}.webp`, async () => new Response(png, { status: 200 }))
  assert.equal(image.role, "face")
  assert.equal(image.mediaType, "image/webp")
  await assert.rejects(() => fetchFaceBytes("img/full/../secret.png", async () => new Response(png)), /脸部图路径无效/)
  const notices = licenseNotices()
  assert.match(notices, /脸部与表情参考/)
  assert.match(notices, /CC0/)
  assert.match(notices, /https:\/\/x\.com\/giaaibusi/)
  assert.match(notices, /https:\/\/ai-portrait-gallery\.pages\.dev\//)
  assert.match(notices, /编号、分区、发长、中日文造型名和公开图地址/)
  assert.match(notices, /sleepy-zone\/ai-ref-library-cn/)
})
