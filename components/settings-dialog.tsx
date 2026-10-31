"use client"

import { useState, type ReactNode } from "react"
import { ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { textModelFor } from "@/shared/beautify.mjs"
import { baseURLFor, modelFor, type StudioSettings } from "@/lib/settings"
import { ASPECT_LABEL, ASPECT_RATIOS, type AspectRatio, type ProviderId } from "@/lib/types"
import { studioUrl, useStudioEnv } from "@/lib/studio-env"

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: StudioSettings
  onChange: (settings: StudioSettings) => void
}) {
  const { basePath } = useStudioEnv()
  const [connection, setConnection] = useState("")
  const [checking, setChecking] = useState(false)
  async function checkConnection() {
    setChecking(true)
    setConnection("")
    try {
      const response = await fetch(studioUrl(basePath, "/api/comfyui"))
      const body = await response.json() as { error?: string; workflow?: string }
      setConnection(response.ok ? `已连接：${body.workflow}。节点和模型将在生成前检查。` : body.error || "连接失败")
    } catch { setConnection("无法连接，请确认本机工作室和 ComfyUI 已启动。") }
    finally { setChecking(false) }
  }
  function patch(partial: Partial<StudioSettings>) {
    onChange({ ...settings, ...partial })
  }

  function chooseProvider(provider: ProviderId) {
    const stock = settings.model === modelFor(settings.provider) || settings.model.trim() === ""
    const previousBase = baseURLFor(settings.provider)
    const baseIsDefault = settings.baseURL.trim() === "" || settings.baseURL === previousBase
    patch({
      provider,
      model: stock ? modelFor(provider) : settings.model,
      baseURL: baseIsDefault ? baseURLFor(provider) : settings.baseURL,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(85dvh,85%)] max-w-[min(32rem,calc(100%-2rem))] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>生图设置</DialogTitle>
          <DialogDescription>密钥存在这台浏览器的本地存储里，不会写进仓库，也不会出现在提示词里。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="flex gap-2">
            <Button variant={settings.engine === "cloud" ? "default" : "outline"} onClick={() => patch({ engine: "cloud" })}>云端生成</Button>
            <Button variant={settings.engine === "comfyui" ? "default" : "outline"} onClick={() => patch({ engine: "comfyui" })}>ComfyUI 本地</Button>
          </div>
          {settings.engine === "comfyui" ? (
            <div className="grid gap-2 rounded-xl bg-muted p-3 text-sm">
              <p>统一换装与姿势工作流：选择服装、姿势或两者，网页自动切换分支。拼图逐格生成后排版，无需生图 API Key。</p>
              <p className="text-xs leading-5 text-muted-foreground">请在同一台电脑启动工作室和 ComfyUI。服务需设置 LANPOSE_COMFYUI=1，默认连接 127.0.0.1:8188。人物和参考图会存入本机 ComfyUI 的 input，结果保存在 output。下方云端配置保留给文字润色及其他云端功能。</p>
              <Button variant="outline" disabled={checking} onClick={() => void checkConnection()}>{checking ? "检查中…" : "测试本机连接"}</Button>
              {connection ? <p role="status" className="text-xs leading-5">{connection}</p> : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant={settings.provider === "seedream" ? "default" : "outline"} onClick={() => chooseProvider("seedream")}>Seedream</Button>
            <Button variant={settings.provider === "gemini" ? "default" : "outline"} onClick={() => chooseProvider("gemini")}>Gemini</Button>
            <Button variant={settings.provider === "openai" ? "default" : "outline"} onClick={() => chooseProvider("openai")}>OpenAI</Button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {settings.provider === "seedream"
              ? "火山方舟 Seedream。会把模特图和姿势线稿一起提交，默认生图模型 doubao-seedream-5-0-flash-260915。"
              : settings.provider === "gemini"
                ? "默认生图模型 gemini-2.5-flash-image。官方地址留空即可；中转站把根地址填进下面。"
                : "会先把模特图和姿势线稿交给 images/edits。接口不支持编辑时，自动改走文生图，并在结果上标明。"}
          </p>
          <div className="grid gap-1.5 text-sm">
            <div className="flex items-center gap-1">
              <span>API Key</span>
              {settings.provider === "seedream" ? (
                <a
                  href="https://exp.volcengine.com/ark/gen_image?model=doubao-seedream-5-0-flash-260915"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="去申请 API Key"
                  title="去申请 API Key"
                  className="inline-flex size-5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </div>
            <Input type="password" autoComplete="off" value={settings.apiKey} onChange={(event) => patch({ apiKey: event.target.value })} placeholder={settings.provider === "seedream" ? "填入火山方舟 API Key" : "填入 API Key"} />
          </div>
          <Field label="接口根地址">
            <Input
              value={settings.baseURL}
              onChange={(event) => patch({ baseURL: event.target.value })}
              placeholder={settings.provider === "seedream" ? "https://ark.cn-beijing.volces.com/api/v3" : settings.provider === "gemini" ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1"}
            />
          </Field>
          <Field label="生图模型">
            <Input value={settings.model} onChange={(event) => patch({ model: event.target.value })} placeholder={modelFor(settings.provider)} />
          </Field>
          <Field label="文本模型（可选）" hint="只用于「扩写提示词」。留空则使用当前接口的默认文本模型。">
            <Input
              value={settings.textModel}
              onChange={(event) => patch({ textModel: event.target.value })}
              placeholder={textModelFor(settings.provider, "")}
            />
          </Field>
          <div className="grid gap-2">
            <Label>比例</Label>
            <div className="flex flex-wrap gap-1.5">
              {ASPECT_RATIOS.map((ratio) => (
                <Button key={ratio} size="sm" variant={settings.aspectRatio === ratio ? "default" : "outline"} onClick={() => patch({ aspectRatio: ratio as AspectRatio })}>
                  {ASPECT_LABEL[ratio]}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={settings.mode === "each" ? "default" : "outline"} onClick={() => patch({ mode: "each" })}>逐张</Button>
            <Button variant={settings.mode === "sheet" ? "default" : "outline"} onClick={() => patch({ mode: "sheet" })}>拼成一张</Button>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-3 text-sm">
            <span>
              <span className="block font-medium">显示成人向姿势</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">性感系、双人缠绵，以及上半身里的大胆分类。参考图仍是结构线稿，默认继续保持服装。</span>
            </span>
            <Switch checked={settings.showAdult} onCheckedChange={(value) => patch({ showAdult: value })} aria-label="显示成人向姿势" />
          </label>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs leading-5 text-muted-foreground">{hint}</span> : null}
    </label>
  )
}
