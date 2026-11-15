import { assertBaseURL, defaultBaseURL, defaultModel } from "./generate.mjs"

function trimmed(value) {
  return typeof value === "string" ? value.trim() : ""
}

export function sameProviderRoot(provider, first, second) {
  try {
    const canonical = url => assertBaseURL(url) || defaultBaseURL(provider)
    return canonical(first) === canonical(second)
  } catch {
    return false
  }
}

export function applyEnvCredentials(body, config = {}) {
  const configProvider = trimmed(config.provider) || "gemini"
  const namedEnv = trimmed(process.env.POSE_MUSE_PROVIDER)
  const envDefaults = config.envDefaults ?? config
  const initialProvider = trimmed(envDefaults.provider) || "gemini"
  const envProvider = namedEnv || initialProvider
  const provider = trimmed(body.provider) || namedEnv || configProvider
  const useEnv = envProvider === provider
  const useConfig = configProvider === provider
  const configRoot = useConfig ? trimmed(config.baseURL) : ""
  const explicitEnvRoot = useEnv ? trimmed(process.env.POSE_MUSE_BASE_URL) : ""
  const envRoot = explicitEnvRoot || (useEnv && provider === initialProvider && trimmed(envDefaults.baseURL)) || ""
  const baseURL = trimmed(body.baseURL) || explicitEnvRoot || configRoot || envRoot || (provider === "seedream" ? defaultBaseURL(provider) : "")
  const envMatches = useEnv && sameProviderRoot(provider, baseURL, envRoot)
  const configMatches = useConfig && sameProviderRoot(provider, baseURL, configRoot)
  const model = trimmed(body.model)
  const legacySeedreamModel = provider === "seedream" && model === defaultModel("gemini")
    && baseURL.replace(/\/$/, "") === defaultBaseURL("seedream")
  return {
    ...body,
    provider,
    apiKey: trimmed(body.apiKey) || (envMatches && trimmed(process.env.POSE_MUSE_API_KEY)) || (configMatches && trimmed(config.apiKey)) || "",
    model: (!legacySeedreamModel && model) || (envMatches && trimmed(process.env.POSE_MUSE_MODEL))
      || (configMatches && trimmed(config.model)) || (provider === "seedream" ? defaultModel(provider) : ""),
    baseURL,
  }
}

export function serverProviderStatus(config = {}) {
  const { provider, apiKey, model, baseURL } = applyEnvCredentials({}, config)
  const configured = apiKey || model || baseURL || config.provider || trimmed(process.env.POSE_MUSE_PROVIDER)
  return {
    provider: configured && ["openai", "seedream", "gemini"].includes(provider) ? provider : "",
    keyConfigured: Boolean(apiKey),
    model,
    baseURL,
  }
}
