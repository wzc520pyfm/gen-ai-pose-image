export function overlayPortalProps(container) {
  if (container == null) return {}
  return { UNSTABLE_portalContainer: container }
}
