"use client"

/* eslint-disable @next/next/no-img-element -- the provider test returns an inline PNG thumbnail for both studio hosts */

import { useEffect, useId, useRef, useState } from "react"
import { ChevronDown, FlaskConical, List, LoaderCircle, PlugZap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { StudioSettings } from "@/lib/settings"
import { defaultModel } from "@/shared/generate.mjs"
import { studioUrl, useStudioEnv } from "@/lib/studio-env"
import { textModelFor } from "@/shared/beautify.mjs"
import type { ConnectionTestResult, ImageTestResult, ModelListResult, ProviderModel } from "@/shared/provider-settings.mjs"

type RequestState<T> = { busy: boolean; data: T | null; error: string }
const idle = { busy: false, data: null, error: "" }

function useProviderRequest<T>(input: object, read: (payload: Partial<ModelListResult & ImageTestResult & ConnectionTestResult>) => T) {
  const { basePath } = useStudioEnv()
  const body = JSON.stringify(input)
  const active = useRef<AbortController | null>(null)
  const [state, setState] = useState<RequestState<T>>(idle)
  useEffect(() => {
    setState(idle)
    return () => {
      active.current?.abort()
      active.current = null
    }
  }, [basePath, body])

  async function run() {
    if (active.current) return
    const controller = new AbortController()
    active.current = controller
    setState(previous => ({ ...previous, busy: true, error: "" }))
    try {
      const response = await fetch(studioUrl(basePath, "/api/provider"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload || payload.error) {
        throw new Error(payload?.error || `请求失败（HTTP ${response.status}），请重试。`)
      }
      const data = read(payload)
      if (!controller.signal.aborted) setState({ busy: false, data, error: "" })
    } catch (error) {
      if (!controller.signal.aborted) {
        setState({ busy: false, data: null, error: error instanceof Error ? error.message : "请求失败，请重试。" })
      }
    } finally {
      if (active.current === controller) active.current = null
    }
  }
  return { ...state, run }
}

export function CloudModelSettings({ settings, patch }: {
  settings: StudioSettings
  patch: (change: Partial<StudioSettings>) => void
}) {
  const { provider, apiKey, baseURL, model, textModel } = settings
  const connection = { provider, apiKey, baseURL }
  const [directoryAction, setDirectoryAction] = useState<"check" | "list">("check")
  const check = useProviderRequest({ ...connection, action: "test-connection" }, payload => {
    if (payload.connected !== true || typeof payload.latencyMs !== "number" || !Number.isFinite(payload.latencyMs)) {
      throw new Error("接口未返回有效的连接检测结果。")
    }
    return payload.latencyMs
  })
  const list = useProviderRequest({ ...connection, action: "list-models" }, payload => {
    if (!Array.isArray(payload.models)) throw new Error("接口没有返回模型列表。")
    return payload.models
  })
  const test = useProviderRequest({ ...connection, model, action: "test-image" }, payload => {
    if (!payload.model || !payload.previewBase64) throw new Error("模型没有返回测试图。")
    return { model: payload.model, previewBase64: payload.previewBase64 }
  })
  const checking = directoryAction === "check"
  const directory = checking ? check : list
  const directoryBusy = check.busy || list.busy
  let directoryStatus = directory.error || "测试连接仅读取模型目录。"
  if (directory.busy) directoryStatus = checking ? "正在检测连接…" : "正在获取模型列表…"
  else if (checking && check.data !== null) directoryStatus = `接口已连通，模型目录响应耗时 ${check.data} 毫秒。`
  else if (!checking && list.data) directoryStatus = list.data.length ? `已获取 ${list.data.length} 个模型` : "接口未列出可选模型，可手动填写。"
  return (
    <>
      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={directoryBusy} onClick={() => { setDirectoryAction("check"); void check.run() }}>
            {check.busy ? <LoaderCircle className="motion-safe:animate-spin" /> : <PlugZap />}
            测试连接
          </Button>
          <Button variant="outline" disabled={directoryBusy} onClick={() => { setDirectoryAction("list"); void list.run() }}>
            {list.busy ? <LoaderCircle className="motion-safe:animate-spin" /> : <List />}
            {list.data ? "刷新模型列表" : "获取模型列表"}
          </Button>
        </div>
        <span role="status" className={`min-w-0 text-xs leading-5 [overflow-wrap:anywhere] ${directory.error ? "text-destructive" : "text-muted-foreground"}`}>{directoryStatus}</span>
      </div>
      <ModelField label="生图模型" kind="image" value={model} fallback={defaultModel(provider)} models={list.data} onChange={value => patch({ model: value })} />
      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button variant="outline" disabled={test.busy} onClick={() => void test.run()}>
            {test.busy ? <LoaderCircle className="motion-safe:animate-spin" /> : <FlaskConical />}
            {test.busy ? "测试中…" : "测试生图"}
          </Button>
          <span className="text-xs text-muted-foreground">生成 1 张测试图，可能消耗额度。</span>
        </div>
        <div role="status" className="empty:hidden text-xs leading-5">
          {test.busy ? "正在等待模型返回图片…" : test.error ? (
            <p className="text-destructive [overflow-wrap:anywhere]">测试失败。{test.error}</p>
          ) : test.data ? (
            <div className="flex items-center gap-2">
              <img src={`data:image/png;base64,${test.data.previewBase64}`} width={48} height={48} alt="模型返回的测试图" className="size-12 rounded-md border border-border object-contain" />
              <p className="min-w-0 [overflow-wrap:anywhere]">测试成功，{test.data.model} 已返回图片。</p>
            </div>
          ) : null}
        </div>
      </div>
      <ModelField label="文本模型（可选）" kind="text" value={textModel} fallback={textModelFor(provider, "")} models={list.data} onChange={value => patch({ textModel: value })} />
    </>
  )
}

function ModelField({ label, kind, value, fallback, models, onChange }: {
  label: string
  kind: "image" | "text"
  value: string
  fallback: string
  models: ProviderModel[] | null
  onChange: (value: string) => void
}) {
  const id = useId()
  const [manual, setManual] = useState(false)
  const preferred = (model: ProviderModel) => model.outputs?.includes(kind) || /image|seedream|dall-e/i.test(model.id) === (kind === "image")
  const options = (models || []).filter(model => !model.outputs || model.outputs.includes(kind))
    .sort((a, b) => Number(preferred(b)) - Number(preferred(a)))
  const fromList = options.length > 0 && !manual
  return (
    <div className="grid min-w-0 gap-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id}>{label}</label>
        {options.length > 0 && (
          <Button size="xs" variant="link" onClick={() => setManual(!manual)} aria-label={`${label}：${manual ? "从列表选择" : "手动填写"}`}>
            {manual ? "从列表选择" : "手动填写"}
          </Button>
        )}
      </div>
      {fromList ? (
        <div className="relative min-w-0">
          <select id={id} value={value} onChange={event => onChange(event.target.value)}
            className="h-8 w-full min-w-0 appearance-none truncate rounded-lg border border-input bg-card pr-8 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
            <option value="">使用默认模型（{fallback}）</option>
            {value && !options.some(option => option.id === value) && <option value={value}>当前设置 · {value}</option>}
            {options.map(model => <option key={model.id} value={model.id}>{model.id}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
      ) : <Input id={id} value={value} onChange={event => onChange(event.target.value)} placeholder={fallback} />}
      {Boolean(models?.length) && !options.length && <p className="text-xs text-muted-foreground">列表中没有此类型的模型，可手动填写。</p>}
      {kind === "text" && <p className="text-xs leading-5 text-muted-foreground">用于「扩写提示词」。留空使用默认文本模型。</p>}
    </div>
  )
}
