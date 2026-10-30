export function comfyURL(env?: Record<string, string | undefined>): string
export function assertLocalRequest(url: string, origin?: string | null): void
export function checkComfy(input?: { signal?: AbortSignal }): Promise<{ available: boolean; workflow: string }>
