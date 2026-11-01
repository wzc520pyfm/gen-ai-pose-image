import assert from "node:assert/strict"
import { test } from "node:test"
import { getAnimePoseCatalog, getCatalog, resolveView, searchPoses } from "./catalog.mjs"
import { fetchCostumeBytes, getAnimeCostumeCatalog, getCostume, getCostumeCatalog, searchCostumes } from "./costumes.mjs"
import { fetchFaceBytes, getAnimeFaceCatalog, getFace, getFaceCatalog, searchFaces } from "./faces.mjs"
import { fetchPoseBytes } from "./poses.mjs"
import { composePrompt } from "./prompt.mjs"
import { isAllowedRemoteImage } from "./remote-image.mjs"
import { toCostumeSearchResult, toPoseSearchResult } from "./custom.mjs"
import { toFaceSearchResult } from "./faces.mjs"
import { DEFAULT_CHARACTER } from "./character.mjs"
import { licenseNotices } from "./license.mjs"

test("anime plates stay out of the live catalogs and name the original host", () => {
  assert.equal(getCatalog().poseCount, 288)
  assert.equal(getCatalog().poses.some((pose) => pose.systemId === "anime"), false)
  const anime = getAnimePoseCatalog()
  assert.equal(anime.poseCount, 281)
  assert.equal(anime.origin, "https://charadb-2fi.pages.dev")
  assert.match(anime.attribution, /原站/)
  assert.match(anime.attribution, /たき AI/)
  const pose = anime.poses.find((item) => item.code === "P001")
  assert.equal(pose.credit, "charadb-2fi.pages.dev")
  assert.equal(pose.author, "たき AI")
  assert.equal(pose.sourceUrl, "https://charadb-2fi.pages.dev/")
  assert.equal(pose.views[0].full, "https://charadb-2fi.pages.dev/line/P001.png")
  assert.equal(isAllowedRemoteImage(pose.views[0].thumb), true)
  assert.equal(isAllowedRemoteImage("https://publicdomainq.net/pictures/a.jpg"), false)
  assert.equal(isAllowedRemoteImage("https://upload.wikimedia.org/wikipedia/commons/a/a1/Anime_Verdolaga.png"), false)
  assert.equal(resolveView("anime_P001").pose.name, "立正")
  assert.equal(searchPoses({ query: "立正", limit: 5 }).length, 0)
  const found = searchPoses({ systemId: "anime", query: "立正", limit: 5 })
  assert.equal(found[0].id, "anime_P001")
  assert.equal(toPoseSearchResult(found).poses[0].sourceUrl, "https://charadb-2fi.pages.dev/")

  assert.equal(getCostumeCatalog().total, 1407)
  assert.equal(getCostumeCatalog().costumes.some((item) => item.id === "O001"), false)
  const costumes = getAnimeCostumeCatalog()
  assert.equal(costumes.total, 439)
  assert.equal(getCostume("O001").label, "水手服（藏青）")
  assert.equal(getCostume("O001").plate, "worn")
  assert.equal(getCostume("O018"), undefined)
  assert.equal(searchCostumes({ query: "serafuku", limit: 5 }).length, 0)
  const sailor = searchCostumes({ realm: "anime", query: "serafuku", limit: 5 })
  assert.ok(sailor.some((item) => item.id === "O001"))
  assert.equal(searchCostumes({ category: "swim", includeAdult: false, limit: 5 }).length, 0)
  assert.equal(searchCostumes({ category: "swim", includeAdult: true, limit: 3 }).every((item) => item.adult), true)
  assert.equal(toCostumeSearchResult(sailor).costumes[0].credit, "charadb-2fi.pages.dev")

  assert.equal(getFaceCatalog().total, 1499)
  assert.equal(getFaceCatalog().faces.some((item) => item.id === "H001"), false)
  const faces = getAnimeFaceCatalog()
  assert.equal(faces.total, 306)
  assert.equal(getFace("H001").section, "style")
  assert.equal(getFace("H001").hair, "长发")
  assert.equal(searchFaces({ query: "long hair", limit: 5 }).some((item) => item.id === "H001"), false)
  const hair = searchFaces({ realm: "anime", section: "style", hair: "长发", query: "H001", limit: 5 })
  assert.equal(hair[0].id, "H001")
  assert.equal(toFaceSearchResult(hair).faces[0].author, "たき AI")

  const notices = licenseNotices()
  assert.match(notices, /二次元姿势、服装与脸部/)
  assert.match(notices, /https:\/\/charadb-2fi\.pages\.dev\//)
  assert.match(notices, /たき AI/)
  assert.match(notices, /https:\/\/x\.com\/taki_auto/)
})

test("a worn anime outfit does not replace the live costume wording", () => {
  const text = composePrompt({
    character: DEFAULT_CHARACTER,
    poses: [{ name: "立正", category: "站姿", system: "二次元姿势", angle: "正面", people: 1, plate: "line" }],
    costume: { id: "O001", keywords: "serafuku", plate: "worn" },
    keepOutfit: true,
  })
  assert.match(text, /穿着衣服的参考，只取衣服/)
  assert.match(text, /不要照抄穿着者的脸/)
  assert.match(text, /只从线稿提取身体姿态/)
})

test("anime image fetches stay on the original host", async () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xd9]), Buffer.alloc(64)])
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(64)])
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(64)])
  const poseUrl = "https://charadb-2fi.pages.dev/line/P001.png"
  let requested = ""
  const pose = await fetchPoseBytes(poseUrl, async (url) => {
    requested = url
    return new Response(png, { status: 200, headers: { "content-type": "image/png" } })
  })
  assert.equal(requested, poseUrl)
  assert.equal(pose.role, "pose")
  assert.equal(pose.mediaType, "image/png")
  const costume = await fetchCostumeBytes(getCostume("O001").thumb, async () => new Response(webp, { status: 200, headers: { "content-type": "image/webp" } }))
  assert.equal(costume.role, "costume")
  const face = await fetchFaceBytes(getFace("H001").full, async () => new Response(jpeg, { status: 200, headers: { "content-type": "image/jpeg" } }))
  assert.equal(face.role, "face")
  await assert.rejects(() => fetchPoseBytes("https://evil.example/line/P001.png", async () => new Response(png)), /图片地址无效/)
})
