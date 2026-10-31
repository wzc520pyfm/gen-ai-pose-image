# 在线网页连接 ComfyUI

打开部署在 Vercel 的澜姿，在「生图设置」选择「ComfyUI」，填入地址并点击「测试连接」。无需在显卡电脑启动网站服务。原有云端服务商、素材库、历史和下载继续保留。

## 本机连接

在运行 ComfyUI 的电脑上打开网站，填写 `http://127.0.0.1:8188`。启动 ComfyUI 时允许**实际网站来源**，例如在原启动命令后添加：

```text
--enable-cors-header https://your-studio.vercel.app
```

来源只包含协议、主机和端口，不带路径或结尾斜线；Preview 与正式站是不同来源，测试时填写 Preview 的实际来源。ComfyUI 使用其他端口时相应修改网页地址。仅监听回环地址即可，本机使用不需要开放到公网。

HTTPS 网站连接本机服务可能触发浏览器的本地网络访问权限提示，需点击允许。如果被拒绝，在浏览器的网站权限中重新允许，然后重试。不需要关闭浏览器安全保护。不同浏览器对本地访问的支持不同，当前 Chromium 浏览器优先；受浏览器限制时可使用 HTTPS 入口。[Chrome 本地网络权限说明](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access)

连接测试只检查服务可达和基本响应；生成前检查选中工作流分支的节点及模型。连接检查超时 10 秒，每格生成超时 10 分钟。请求失败可能来自 CORS、浏览器权限、证书、服务未启动或网络不通，浏览器未必能区分具体原因。

## 手机或其他电脑

在网页填写指向显卡电脑的 HTTPS 入口，例如 `https://comfy.example.com` 或 `https://example.com/comfy`。网页地址必须直接提供 ComfyUI HTTP API，不能只是一个登录页。`127.0.0.1` 始终指正在访问网页的设备；手机上的回环地址不会连接家中的电脑。

显卡电脑需保持唤醒，ComfyUI、模型节点和远程入口均需可用。公网域名需正确解析、端口转发或隧道等网络条件；单独使用 `--listen` 不会穿透 NAT。私有网络也可以提供可达的 HTTPS 入口。

网页的「访问令牌」会以 `Authorization: Bearer ...` 发送，**入口必须实际校验**，原生 ComfyUI 不会因为填了令牌就自动受保护。公网入口请配置鉴权。令牌只保留在当前页面内存，刷新后重新填写；地址保存在浏览器设置。地址不能带账号密码、查询参数或片段。客户端不携带跨站 Cookie、不跟随重定向，交互式登录网关不能直接当作 Bearer API 使用。

浏览器直接上传、提交任务、轮询并获取结果，Vercel 不代理 ComfyUI 请求，也不承担其 GPU 运算。带令牌的跨域请求需允许 OPTIONS 预检及 Authorization 请求头。[ComfyUI HTTP API](https://docs.comfy.org/development/comfyui-server/comms_routes)

### HTTPS 反向代理示例：Caddy

以下配置适用于个人使用，Caddy 与 ComfyUI 位于同一电脑。需要安装 Caddy、可用域名及其 HTTPS 网络条件。将 `comfy.example.com` 改为自己的入口域名，设置 `STUDIO_ORIGIN` 为实际网站来源，`COMFYUI_ACCESS_TOKEN` 为足够长的随机令牌。不要把实际令牌写入仓库。

```caddyfile
comfy.example.com {
    route {
        @allowed header Origin {$STUDIO_ORIGIN}
        header @allowed {
            Access-Control-Allow-Origin {$STUDIO_ORIGIN}
            Access-Control-Allow-Methods "GET, POST, OPTIONS"
            Access-Control-Allow-Headers "Authorization, Content-Type"
            Vary Origin
        }
        @preflight {
            method OPTIONS
            header Origin {$STUDIO_ORIGIN}
        }
        respond @preflight 204
        @wrongOrigin {
            header Origin *
            not header Origin {$STUDIO_ORIGIN}
        }
        respond @wrongOrigin "Origin rejected" 403
        @unauthorized not header Authorization "Bearer {$COMFYUI_ACCESS_TOKEN}"
        respond @unauthorized "Unauthorized" 401
        @read {
            method GET
            path /system_stats /object_info /history/* /view
        }
        handle @read {
            reverse_proxy 127.0.0.1:8188 {
                header_up -Authorization
                header_up -Origin
                header_up -Sec-Fetch-Site
            }
        }
        @write {
            method POST
            path /upload/image /prompt /queue
        }
        handle @write {
            reverse_proxy 127.0.0.1:8188 {
                header_up -Authorization
                header_up -Origin
                header_up -Sec-Fetch-Site
            }
        }
        respond "Not found" 404
    }
}
```

网关先校验来源、Bearer 令牌和 API 白名单，再清理转发给 ComfyUI 的 `Origin`、`Sec-Fetch-Site` 和令牌头。部分 ComfyUI 版本在未启用自身 CORS 时会拒绝 `Sec-Fetch-Site: cross-site`，因此命令行连接成功仍需实际浏览器验收。不要在没有入口鉴权与来源检查的代理上直接套用这些清理规则。

OPTIONS 不需要令牌，实际 API 请求仍须鉴权。代理校验网站来源后移除上游 Origin，避免 ComfyUI 再次拒绝；CORS 由代理统一处理，ComfyUI 不需要额外启用 CORS。此入口不提供 ComfyUI 编辑器、不开放 `/interrupt`、文件管理等接口，不构成多人任务隔离方案。使用隧道时保留同等鉴权及 CORS 设置，不要只把原始 8188 端口发布出去。

启动前确认两个环境变量均非空，先执行 `caddy validate --config Caddyfile --adapter caddyfile`，再启动 Caddy。检验无令牌返回 401、错误来源返回 403、指定来源的 OPTIONS 返回 204，正确令牌可读取 `/system_stats`，然后在网页测试生成。代理配置依据 [Caddy route/handle](https://caddyserver.com/docs/caddyfile/directives/handle) 与[请求匹配器](https://caddyserver.com/docs/caddyfile/matchers)。

## 使用与工作流

- 只选服装：保留原姿势换装；只选姿势：保持原服装换姿势；两者都选：换装并换姿势。至少选择一个。
- 未选服装时，可关闭「保持服装」，按补充描述允许换衣。
- 最多四张模特照片表示同一个人的不同参考。双人姿势由工作流生成第二人，不分别指定两套身份。
- 逐张串行生成；拼图最多四格，由浏览器 Canvas 按选择顺序留白排版。人物照等比例留白到所选比例，拼图外框沿用该比例。
- 拼图部分失败时保留成功结果，十分钟内重试相同输入可复用已完成格子。输入、参考、连接或令牌变化会重新生成；最多缓存四个拼图任务，刷新页面清除。
- 「停止」停止等待和后续提交，并尝试删除自己的待执行任务；已运行任务可能继续完成，不调用会影响其他任务的全局中断。

统一画布位于 [`local-tryon.canvas.json`](../shared/workflows/local-tryon.canvas.json)，运行文件位于 [`local-tryon.api.json`](../shared/workflows/local-tryon.api.json)。拖入 ComfyUI 后，顶部开关控制换装和姿势分支。网页自动设置开关、裁剪不用的分支；只换装不需要 MOSS 分支依赖。

修改画布后导出 API 格式，替换运行文件的 `graph` 并保持 `mapping` 正确，再重新构建部署网站。工作流随客户端打包，不再由网站服务端逐次读取。运行 `npm test` 检查工作流连接和分支。网页覆盖图片、开关、提示词、比例、种子和输出前缀，其余模型及采样参数来自工作流；默认种子 42。

## 依赖与限制

需安装对应 ComfyUI 节点和模型；网页不会下载模型或节点。连接测试检查服务是否可达，生成前检查所用分支的节点和模型选项，任务提交时由 ComfyUI 完整校验。

Qwen 分支使用 Qwen-Image 2.1 Turbo INT8、Qwen3-VL 8B W4A8、对应 VAE、QwenImage21Cache，以及 8 步 Euler sigma 序列。姿势分支另需 MOSS Image SFT INT8、Color/Depth 控制适配器、对应文本编码器与 VAE，以及 Depth Anything V2 Small 预处理器和权重。准确文件名及节点类别见运行文件；只换装不会要求 MOSS 依赖。

内置工作流仅调用所连接 ComfyUI 的节点，不发送云端密钥。输入图会写入 ComfyUI `input`，结果写入 `output/tryon`，成功结果还会保存到原有浏览器历史。浏览器直连生成及提示词预览不向网站服务端提交私人参考图或 ComfyUI 令牌；ComfyUI 模式不自动同步自定义素材给 Agent。原有云端扩写、参考图和模特设定图功能仍按其原有方式访问网站服务端，点击这些功能前请确认云端配置。修改成含云端节点的自定义流程后，数据流和费用由这些节点决定，请自行核对。

Qwen 2.1 的模型许可仅供研究或评估，商业使用需要另获授权；素材和其他模型也应分别遵守各自许可，不能由本项目 MIT 许可推导出模型或素材的商用授权。

本地模型会改变脸部细节，双人姿势、遮挡、手部和衣服保持可能不稳定。接口成功返回图片只说明流程完成，不代表人物或姿势完全准确。

## 从旧版迁移与接口兼容

旧版「ComfyUI 本地」已统一为浏览器直连。原 `engine: "comfyui"` 设置与历史可继续选择 ComfyUI，云端配置保留；首次使用请填地址并测试连接，原有环境变量不再使用。

Next.js 与 Harness 的 `/api/generate`、`/api/prompt` 不再执行 ComfyUI 请求，旧请求会明确报错，不会回退到云端生图。旧 `/api/comfyui` 已删除。浏览器使用 ComfyUI 自身 API，结果继续适配原有卡片及历史结构；Harness 内嵌界面也由浏览器直连。

## 验证范围

协议测试覆盖地址、代理路径、凭据、节点检查、上传、排队、失败、取消、超时、缓存及设置迁移；生产构建同时检查浏览器包不依赖 Node 模块。旧版服务端执行的耗时记录不代表新版浏览器直连已实测。真实 Preview、跨设备 HTTPS、下载落盘等验证结果以对应 PR 的测试记录为准，未具备实际入口时不将模拟响应计作远程实测。私人输入照片与生成结果不提交到仓库。
