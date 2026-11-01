import assert from "node:assert/strict"
import { test } from "node:test"
import { getCatalog, resolveView, searchPoses } from "./catalog.mjs"
import { fetchCostumeBytes, getCostume, getCostumeCatalog, searchCostumes } from "./costumes.mjs"
import { fetchFaceBytes, getFace, getFaceCatalog, searchFaces } from "./faces.mjs"
import { fetchPoseBytes, isSafePosePath } from "./poses.mjs"
import { composePrompt } from "./prompt.mjs"
import { isAllowedRemoteImage } from "./remote-image.mjs"
import { toCostumeSearchResult, toPoseSearchResult } from "./custom.mjs"
import { toFaceSearchResult } from "./faces.mjs"
import { DEFAULT_CHARACTER } from "./character.mjs"
import { licenseNotices } from "./license.mjs"

test("anime plates join the catalogs and name only their image hosts", () => {
  const poses = getCatalog()
  const pose = poses.poses.find((item) => item.id === "anime_single_A01")
  assert.ok(pose)
  assert.equal(pose.systemId, "anime")
  assert.equal(pose.plate, "illustration")
  assert.equal(pose.credit, "publicdomainq.net")
  assert.equal(pose.sourceUrl, "https://publicdomainq.net/ai-generated-woman-anime-0088903/")
  assert.equal(isAllowedRemoteImage(pose.views[0].full), true)
  assert.equal(isSafePosePath(pose.views[0].full), false)
  assert.equal(isSafePosePath("https://evil.example/a.jpg"), false)
  assert.equal(isAllowedRemoteImage("https://evil.example/a.jpg"), false)
  assert.equal(isAllowedRemoteImage("https://publicdomainq.net.evil.example/pictures/a.jpg"), false)
  assert.equal(isAllowedRemoteImage("https://upload.wikimedia.org/wikipedia/commons/c/c5/Angry_anime_girl.png"), true)
  assert.equal(resolveView("anime_single_A07").view.angle, "侧面")
  const found = searchPoses({ query: "二次元 插兜", systemId: "anime", limit: 5 })
  assert.ok(found.some((item) => item.id === "anime_single_A04"))
  assert.equal(toPoseSearchResult(found).poses[0].credit, "publicdomainq.net")

  const costumes = getCostumeCatalog()
  assert.equal(costumes.total, 1415)
  assert.equal(getCostume("ANM-0001").plate, "worn")
  assert.equal(getCostume("ANM-0001").credit, "publicdomainq.net")
  const kimono = searchCostumes({ category: "kimono", limit: 10 })
  assert.equal(kimono.length, 4)
  assert.equal(toCostumeSearchResult(kimono).costumes[0].sourceUrl.startsWith("https://publicdomainq.net/"), true)

  const faces = getFaceCatalog()
  assert.equal(faces.total, 1507)
  const angry = getFace("anime_face_angry")
  assert.equal(angry.section, "anime-expression")
  assert.equal(angry.credit, "commons.wikimedia.org")
  assert.equal(angry.author, "snoopingasusual")
  assert.equal(angry.license, "CC0-1.0")
  const expressions = searchFaces({ section: "anime-expression", limit: 10 })
  assert.equal(expressions.length, 3)
  assert.equal(toFaceSearchResult(expressions).faces.every((item) => item.sourceUrl.startsWith("https://")), true)

  const notices = licenseNotices()
  assert.match(notices, /二次元姿势、服装与脸部补充/)
  assert.match(notices, /https:\/\/publicdomainq\.net\//)
  assert.match(notices, /https:\/\/commons\.wikimedia\.org\//)
})

test("illustration plates tell the prompt to copy pose or clothes only", () => {
  const pose = getCatalog().poses.find((item) => item.id === "anime_single_A05")
  const costume = getCostume("ANM-0005")
  const text = composePrompt({
    character: DEFAULT_CHARACTER,
    poses: [{ name: pose.name, category: pose.category, system: pose.system, angle: "正面", people: 1, plate: pose.plate }],
    costume: { id: costume.id, keywords: costume.keywords, plate: costume.plate },
    keepOutfit: true,
  })
  assert.match(text, /标注为插画的姿势参考不是关节线稿/)
  assert.match(text, /穿着衣服的参考，只取衣服/)
  assert.match(text, /不要照抄穿着者的脸/)
  assert.doesNotMatch(text, /中间那张参考图只有衣服，没有人物/)
})

test("remote image fetches stay on the image host", async () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xd9]), Buffer.alloc(64)])
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(64)])
  const poseUrl = "https://publicdomainq.net/pictures/2025s/2025-07s/2025-07-08s/publicdomainq-0088903ukd.jpg"
  let requested = ""
  const pose = await fetchPoseBytes(poseUrl, async (url) => {
    requested = url
    return new Response(jpeg, { status: 200, headers: { "content-type": "image/jpeg" } })
  })
  assert.equal(requested, poseUrl)
  assert.equal(pose.mediaType, "image/jpeg")
  assert.equal(pose.role, "pose")
  const faceUrl = "https://upload.wikimedia.org/wikipedia/commons/c/c5/Angry_anime_girl.png"
  const face = await fetchFaceBytes(faceUrl, async () => new Response(png, { status: 200, headers: { "content-type": "image/png" } }))
  assert.equal(face.role, "face")
  assert.equal(face.mediaType, "image/png")
  const costumeUrl = getCostume("ANM-0008").thumb
  const costume = await fetchCostumeBytes(costumeUrl, async () => new Response(jpeg, { status: 200, headers: { "content-type": "image/jpeg" } }))
  assert.equal(costume.role, "costume")
  await assert.rejects(() => fetchPoseBytes("https://user:pass@publicdomainq.net/pictures/a.jpg", async () => new Response(jpeg)), /图片地址无效/)
  await assert.rejects(() => fetchCostumeBytes("https://upload.wikimedia.org/wikipedia/commons/../../etc/passwd.png", async () => new Response(png)), /图片地址无效/)
})
