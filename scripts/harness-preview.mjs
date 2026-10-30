import { createServer } from "node:http"
import { mkdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import * as esbuild from "esbuild"
import { createPoseHandler } from "../plugin/http.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const port = Number(process.env.PORT || 43124)
const reactBundle = join(root, "scripts/.generated/preview-react.js")
await mkdir(dirname(reactBundle), { recursive: true })

await esbuild.build({
  absWorkingDir: root,
  stdin: {
    contents: `
      import * as React from "react"
      import * as ReactDOM from "react-dom"
      import * as ReactDOMClient from "react-dom/client"
      import * as JSX from "react/jsx-runtime"
      globalThis.__lanposeRequire = {
        react: React,
        "react-dom": ReactDOM,
        "react-dom/client": ReactDOMClient,
        "react/jsx-runtime": JSX,
      }
    `,
    resolveDir: root,
    sourcefile: "preview-react.js",
    loader: "js",
  },
  bundle: true,
  format: "iife",
  platform: "browser",
  outfile: reactBundle,
  legalComments: "none",
})

const handle = createPoseHandler(() => ({
  provider: "gemini",
  model: "",
  baseURL: "",
  apiKey: "",
  aspectRatio: "3:4",
  poseOrigin: "https://ai-pose-gallery.anhao.app",
}))

const page = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>澜姿 · Harness 预览</title>
  <style>
    html, body, #root { height: 100%; margin: 0; }
    body { background: #0b1220; color: #e2e8f0; font: 14px/1.4 "Outfit Variable", "PingFang SC", "Noto Sans SC", sans-serif; }
    .shell { display: flex; height: 100%; min-height: 0; }
    .rail { width: 220px; flex: none; display: flex; flex-direction: column; gap: 4px; padding: 16px 12px; background: #0f172a; border-right: 1px solid #1e293b; }
    .rail button { display: flex; align-items: center; gap: 8px; width: 100%; border: 0; border-radius: 10px; background: transparent; color: #cbd5e1; text-align: left; padding: 8px 10px; font: inherit; }
    .rail button[aria-current="page"] { background: #1d4ed8; color: white; }
    .stage { flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; background: #e2e8f0; }
    @media (max-width: 700px) {
      .rail { width: 56px; padding: 12px 6px; }
      .rail button span { display: none; }
      .rail button { justify-content: center; padding: 8px; }
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="/preview-react.js"></script>
  <script>
    window.__ModuleLoader__ = {
      load(entry) {
        const table = globalThis.__lanposeRequire
        window.__lanposePlugin = entry.factory((id) => {
          if (!table[id]) throw new Error("preview require missing " + id)
          return table[id]
        })
      },
    }
  </script>
  <script src="/client.js"></script>
  <script>
    const plugin = window.__lanposePlugin
    const found = {}
    plugin.apply({
      slots: {
        register(meta, component) { return { meta, component } },
        inject(name, factory) { found[name] = factory() },
      },
    })
    const React = window.__lanposeRequire.react
    const { createRoot } = window.__lanposeRequire["react-dom/client"]
    const { jsx, jsxs } = window.__lanposeRequire["react/jsx-runtime"]
    const Icon = found["sidebar.panellist"].component
    const Main = found.main.component
    const label = found["sidebar.panellist"].meta.label()
    function Shell() {
      return jsxs("div", { className: "shell", children: [
        jsxs("aside", { className: "rail", "aria-label": "Harness 侧栏", children: [
          jsx("button", { type: "button", children: jsx("span", { children: "对话" }) }),
          jsxs("button", { type: "button", "aria-current": "page", children: [
            jsx(Icon, { size: 16 }),
            jsx("span", { children: label }),
          ] }),
          jsx("button", { type: "button", children: jsx("span", { children: "插件" }) }),
          jsx("button", { type: "button", children: jsx("span", { children: "自动化任务" }) }),
        ] }),
        jsx("main", { className: "stage", children: jsx(Main, {}) }),
      ] })
    }
    createRoot(document.getElementById("root")).render(jsx(Shell, {}))
  </script>
</body>
</html>`

const types = {
  ".js": "text/javascript; charset=utf-8",
  ".html": "text/html; charset=utf-8",
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
  if (url.pathname.startsWith("/dsh-pose-muse")) {
    await handle(req, res)
    return
  }
  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "content-type": types[".html"] })
    res.end(page)
    return
  }
  if (url.pathname === "/preview-react.js") {
    const body = await readFile(reactBundle)
    res.writeHead(200, { "content-type": types[".js"] })
    res.end(body)
    return
  }
  if (url.pathname === "/client.js") {
    const body = await readFile(join(root, "plugin/client.js"))
    res.writeHead(200, { "content-type": types[".js"] })
    res.end(body)
    return
  }
  res.writeHead(404, { "content-type": "text/plain" })
  res.end("not-found")
}).listen(port, "0.0.0.0", () => {
  console.log(`harness preview http://127.0.0.1:${port}`)
})
