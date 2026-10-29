"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { baseURLFor, modelFor, type StudioSettings } from "@/lib/settings"
import { ASPECT_LABEL, ASPECT_RATIOS, type AspectRatio, type ProviderId } from "@/lib/types"

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
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>生图设置</DialogTitle>
          <DialogDescription>密钥存在这台浏览器的本地存储里，不会写进仓库，也不会出现在提示词里。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-2">
            <Button variant={settings.provider === "seedream" ? "default" : "outline"} onClick={() => chooseProvider("seedream")}>Seedream</Button>
            <Button variant={settings.provider === "gemini" ? "default" : "outline"} onClick={() => chooseProvider("gemini")}>Gemini</Button>
            <Button variant={settings.provider === "openai" ? "default" : "outline"} onClick={() => chooseProvider("openai")}>OpenAI</Button>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {settings.provider === "seedream"
              ? "火山方舟 Seedream。会把模特图和姿势线稿一起提交，默认模型 doubao-seedream-5-0-flash-260915。"
              : settings.provider === "gemini"
                ? "默认模型 gemini-2.5-flash-image。官方地址留空即可；中转站把根地址填进下面。"
                : "会先把模特图和姿势线稿交给 images/edits。接口不支持编辑时，自动改走文生图，并在结果上标明。"}
          </p>
          <Field label="API Key">
            <Input type="password" autoComplete="off" value={settings.apiKey} onChange={(event) => patch({ apiKey: event.target.value })} placeholder={settings.provider === "seedream" ? "填入火山方舟 API Key" : "填入 API Key"} />
          </Field>
          <Field label="接口根地址">
            <Input
              value={settings.baseURL}
              onChange={(event) => patch({ baseURL: event.target.value })}
              placeholder={settings.provider === "seedream" ? "https://ark.cn-beijing.volces.com/api/v3" : settings.provider === "gemini" ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1"}
            />
          </Field>
          <Field label="模型">
            <Input value={settings.model} onChange={(event) => patch({ model: event.target.value })} />
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span>{label}</span>
      {children}
    </label>
  )
}
