window.__ModuleLoader__.load({ id: "gen-ai-pose-image", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
  var React = require("react");
  var useEffect = React.useEffect;
  var useState = React.useState;
  var h = React.createElement;
  var LANPOSE_CSS = [
    ".lanpose,.lanpose *{box-sizing:border-box}",
    ".lanpose{height:100%;min-width:0;display:flex;flex-direction:column;overflow:hidden;background:#f6f1e8;color:#1c2433;font:14px/1.5 ui-sans-serif,sans-serif;container-type:inline-size}",
    ".lanpose-scroll{flex:1 1 auto;min-width:0;min-height:0;overflow:auto;padding:12px}",
    ".lanpose h2{margin:0 0 4px;font-family:ui-serif,serif;font-size:22px;line-height:1.2}",
    ".lanpose-lead{margin:0 0 10px;color:#5c6880;font-size:13px}",
    ".lanpose-error{margin:0 0 8px}",
    ".lanpose-search{display:block;width:100%;margin:0 0 10px;padding:8px 10px;border:1px solid #d9d1c4;border-radius:8px;background:#fff;color:inherit;font:inherit}",
    ".lanpose-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}",
    "@media (min-width:720px){.lanpose-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}",
    "@container (min-width:360px){.lanpose-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}",
    "@container (min-width:680px){.lanpose-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}",
    "@container (min-width:980px){.lanpose-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}",
    ".lanpose-card{min-width:0;padding:6px;border:1px solid #e4dccf;border-radius:12px;background:#fff;color:inherit;font:inherit;text-align:left;cursor:pointer}",
    ".lanpose-card.is-on{padding:5px;border:2px solid #2f5bff}",
    ".lanpose-card img{display:block;width:100%;max-width:100%;aspect-ratio:3/4;object-fit:contain;background:#fff}",
    ".lanpose-name{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;margin-top:4px;min-height:2.6em;font-size:12px;line-height:1.3;overflow-wrap:anywhere}",
    ".lanpose-foot{flex:none;min-width:0;display:grid;gap:8px;border-top:1px solid #e4dccf;background:#fffdf8;padding:10px 12px calc(10px + env(safe-area-inset-bottom))}",
    ".lanpose-options{border:1px solid #e4dccf;border-radius:10px;background:#fff;padding:8px 10px}",
    ".lanpose-options summary{cursor:pointer;font-size:13px}",
    ".lanpose-options label{display:block;margin-top:8px;color:#5c6880;font-size:12px}",
    ".lanpose-options textarea,.lanpose-options input{display:block;width:100%;margin-top:4px;padding:8px;border:1px solid #d9d1c4;border-radius:8px;background:#fff;color:#1c2433;font:inherit}",
    ".lanpose-go{width:100%;padding:10px 14px;border:0;border-radius:10px;background:#2f5bff;color:#fff;font:inherit;cursor:pointer}",
    ".lanpose-go:disabled{opacity:.65;cursor:default}",
    ".lanpose-result{max-height:6.5em;margin:0;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}",
    "@container (min-width:640px){.lanpose h2{font-size:28px}.lanpose-scroll{padding:16px}}"
  ].join("");

  function PoseStudio() {
    var catalogState = useState(null);
    var catalog = catalogState[0];
    var setCatalog = catalogState[1];
    var errorState = useState("");
    var error = errorState[0];
    var setError = errorState[1];
    var queryState = useState("");
    var query = queryState[0];
    var setQuery = queryState[1];
    var pickedState = useState({});
    var picked = pickedState[0];
    var setPicked = pickedState[1];
    var noteState = useState("");
    var note = noteState[0];
    var setNote = noteState[1];
    var keyState = useState("");
    var apiKey = keyState[0];
    var setApiKey = keyState[1];
    var resultState = useState("");
    var result = resultState[0];
    var setResult = resultState[1];
    var busyState = useState(false);
    var busy = busyState[0];
    var setBusy = busyState[1];

    useEffect(function () {
      if (!document.getElementById("lanpose-panel-style")) {
        var style = document.createElement("style");
        style.id = "lanpose-panel-style";
        style.textContent = LANPOSE_CSS;
        document.head.appendChild(style);
      }
      var stored = "";
      try { stored = window.localStorage.getItem("lanpose-settings-v1") || ""; } catch (e) { stored = ""; }
      if (stored) {
        try {
          var parsed = JSON.parse(stored);
          if (parsed && typeof parsed.apiKey === "string") setApiKey(parsed.apiKey);
        } catch (e) { /* keep empty */ }
      }
      fetch("/dsh-pose-muse/api/catalog")
        .then(function (response) { if (!response.ok) throw new Error("姿势目录没有加载出来"); return response.json(); })
        .then(setCatalog)
        .catch(function (cause) { setError(cause.message || "姿势目录没有加载出来"); });
    }, []);

    var poses = !catalog ? [] : catalog.poses.filter(function (pose) {
      if (pose.adult) return false;
      if (!query.trim()) return pose.systemId === "full";
      var hay = (pose.name + " " + pose.code + " " + pose.category + " " + pose.id).toLowerCase();
      return query.trim().toLowerCase().split(/\s+/).every(function (part) { return hay.indexOf(part) >= 0; });
    }).slice(0, 60);

    function toggle(pose) {
      var view = pose.views.filter(function (item) { return item.angle === "正面"; })[0] || pose.views[0];
      setPicked(function (current) {
        var next = Object.assign({}, current);
        if (next[pose.id]) delete next[pose.id];
        else next[pose.id] = view.id;
        return next;
      });
    }

    function generate() {
      var ids = Object.keys(picked).map(function (id) { return picked[id]; });
      if (!ids.length) { setResult("先点选姿势。"); return; }
      setBusy(true);
      setResult("");
      fetch("/dsh-pose-muse/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "gemini",
          apiKey: apiKey,
          viewIds: ids,
          mode: "each",
          keepOutfit: true,
          extraPrompt: note,
        }),
      }).then(function (response) { return response.json().then(function (payload) { return { ok: response.ok, payload: payload }; }); })
        .then(function (packed) {
          if (!packed.ok) throw new Error(packed.payload.error || "生图失败");
          var lines = (packed.payload.results || []).map(function (item) {
            return item.ok ? item.title + " 已生成" : item.title + "：" + (item.error || "失败");
          });
          setResult(lines.join("\n") || "没有结果");
        })
        .catch(function (cause) { setResult(cause.message || "生图失败"); })
        .then(function () { setBusy(false); });
    }

    var pickedCount = Object.keys(picked).length;

    return h("div", { className: "lanpose" },
      h("div", { className: "lanpose-scroll" },
        h("h2", null, "澜姿"),
        h("p", { className: "lanpose-lead" }, "默认模特是成年鲸鱼娘大肥鱼。这里先选标准全身姿势；完整画廊在独立工作室里。"),
        error ? h("p", { className: "lanpose-error" }, error) : null,
        h("input", {
          className: "lanpose-search",
          value: query,
          placeholder: "搜索姿势，留空则显示标准全身",
          onChange: function (event) { setQuery(event.target.value); },
        }),
        h("div", { className: "lanpose-grid" },
          poses.map(function (pose) {
            var view = pose.views.filter(function (item) { return item.angle === "正面"; })[0] || pose.views[0];
            var on = Boolean(picked[pose.id]);
            return h("button", {
              key: pose.id,
              type: "button",
              className: on ? "lanpose-card is-on" : "lanpose-card",
              onClick: function () { toggle(pose); },
            },
              h("img", { src: "/dsh-pose-muse/api/pose-image?id=" + encodeURIComponent(view.id) + "&size=thumb", alt: pose.name }),
              h("span", { className: "lanpose-name", title: pose.name }, pose.name)
            );
          })
        )
      ),
      h("form", {
        className: "lanpose-foot",
        onSubmit: function (event) { event.preventDefault(); if (!busy) generate(); },
      },
        h("details", { className: "lanpose-options" },
          h("summary", null, "补充描述和 API Key"),
          h("label", null, "补充描述",
            h("textarea", { value: note, rows: 2, onChange: function (event) { setNote(event.target.value); } })
          ),
          h("label", null, "API Key（留空则用服务器的 POSE_MUSE_API_KEY）",
            h("input", { type: "password", value: apiKey, autoComplete: "off", onChange: function (event) { setApiKey(event.target.value); } })
          )
        ),
        h("button", { type: "submit", className: "lanpose-go", disabled: busy }, busy ? "正在生图" : (pickedCount ? "已选 " + pickedCount + " 个 · 按姿势生图" : "按所选姿势生图")),
        result ? h("pre", { className: "lanpose-result" }, result) : null
      )
    );
  }

  function PosePanelIcon(props) {
    var size = props && props.size ? props.size : 16;
    return h("svg", {
      width: size,
      height: size,
      viewBox: "0 0 16 16",
      fill: "none",
      "aria-hidden": "true",
    },
      h("circle", { cx: "8", cy: "3.1", r: "1.35", stroke: "currentColor", strokeWidth: "1.3" }),
      h("path", {
        d: "M8 4.7v3.4M5.1 7.1h5.8M6.1 13.4 8 8.1l1.9 5.3",
        stroke: "currentColor",
        strokeWidth: "1.3",
        strokeLinecap: "round",
        strokeLinejoin: "round",
      })
    );
  }

  exports.name = "gen-ai-pose-image";
  exports.inject = ["slots"];
  exports.apply = function (ctx) {
    if (!ctx.slots || typeof ctx.slots.inject !== "function" || typeof ctx.slots.register !== "function") return;
    var register = ctx.slots.register.bind(ctx.slots);
    ctx.slots.inject("main", function () {
      return register({
        name: "main",
        key: "pose-muse",
      }, PoseStudio);
    });
    ctx.slots.inject("sidebar.panellist", function () {
      return register({
        name: "sidebar.panellist",
        id: "pose-muse",
        order: 20,
        label: function () { return "姿势"; },
      }, PosePanelIcon);
    });
  };

  return module.exports;
}});
