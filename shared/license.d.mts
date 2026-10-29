export const PROJECT_LICENSE: {
  spdx: "MIT"
  copyright: string
  covers: string
}

export type ThirdPartyNotice = {
  id: string
  title: string
  holder: string
  source: string
  upstream?: string
  author?: string
  included: string
  terms: string
}

export const THIRD_PARTY_NOTICES: ThirdPartyNotice[]

export function licenseNotices(): string
