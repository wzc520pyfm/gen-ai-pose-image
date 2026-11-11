import assert from "node:assert/strict"
import { test } from "node:test"
import { overlayPortalProps } from "../shared/studio-portal.mjs"

test("overlay portal props", () => {
  assert.deepEqual(overlayPortalProps(null), {})
  assert.deepEqual(overlayPortalProps(undefined), {})
  const host = { nodeType: 11 }
  assert.deepEqual(overlayPortalProps(host), { UNSTABLE_portalContainer: host })
})
