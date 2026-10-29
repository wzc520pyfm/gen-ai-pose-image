window.__ModuleLoader__.load({ id: "gen-ai-pose-image", factory: (require) => {
  var module = { exports: {} };
  var exports = module.exports;
  var React = require("react");
  var useEffect = React.useEffect;
  var useState = React.useState;
  var h = React.createElement;

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

    return h("div", { style: { height: "100%", overflow: "auto", padding: 16, background: "#f6f1e8", color: "#1c2433", font: "14px/1.5 sans-serif" } },
      h("h2", { style: { margin: "0 0 4px", fontFamily: "serif", fontSize: 28 } }, "澜姿"),
      h("p", { style: { margin: "0 0 12px", color: "#5c6880" } }, "默认模特是成年鲸鱼娘大飞鱼。这里先选标准全身姿势；完整画廊在独立工作室里。"),
      error ? h("p", null, error) : null,
      h("input", {
        value: query,
        placeholder: "搜索姿势，留空则显示标准全身",
        onChange: function (event) { setQuery(event.target.value); },
        style: { width: "100%", boxSizing: "border-box", marginBottom: 8, padding: 8, borderRadius: 8, border: "1px solid #d9d1c4" },
      }),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 } },
        poses.map(function (pose) {
          var view = pose.views.filter(function (item) { return item.angle === "正面"; })[0] || pose.views[0];
          var on = Boolean(picked[pose.id]);
          return h("button", {
            key: pose.id,
            type: "button",
            onClick: function () { toggle(pose); },
            style: { textAlign: "left", padding: 6, borderRadius: 12, border: on ? "2px solid #2f5bff" : "1px solid #e4dccf", background: "white" },
          },
            h("img", { src: "/dsh-pose-muse/api/pose-image?id=" + encodeURIComponent(view.id) + "&size=thumb", alt: pose.name, style: { width: "100%", aspectRatio: "3 / 4", objectFit: "contain", background: "#fff" } }),
            h("span", { style: { display: "block", marginTop: 4 } }, pose.name)
          );
        })
      ),
      h("label", { style: { display: "block", marginTop: 12 } }, "补充描述",
        h("textarea", { value: note, onChange: function (event) { setNote(event.target.value); }, style: { width: "100%", minHeight: 64, marginTop: 4 } })
      ),
      h("label", { style: { display: "block", marginTop: 8 } }, "API Key（留空则用服务器的 POSE_MUSE_API_KEY）",
        h("input", { type: "password", value: apiKey, onChange: function (event) { setApiKey(event.target.value); }, style: { width: "100%", marginTop: 4, padding: 8 } })
      ),
      h("button", { type: "button", disabled: busy, onClick: generate, style: { marginTop: 12, padding: "10px 14px", border: 0, borderRadius: 10, background: "#2f5bff", color: "white" } }, busy ? "正在生图" : "按所选姿势生图"),
      result ? h("pre", { style: { whiteSpace: "pre-wrap" } }, result) : null
    );
  }

  exports.name = "gen-ai-pose-image";
  exports.inject = ["slots"];
  exports.apply = function (ctx) {
    if (!ctx.slots || typeof ctx.slots.inject !== "function" || typeof ctx.slots.register !== "function") return;
    var register = ctx.slots.register.bind(ctx.slots);
    ctx.slots.inject("conversation.view", function () {
      return register({
        name: "conversation.view",
        id: "pose-muse",
        order: 30,
        label: function () { return "姿势"; },
      }, PoseStudio);
    });
  };

  return module.exports;
}});
