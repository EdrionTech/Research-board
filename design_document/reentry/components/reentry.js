/* @ds-bundle: {"format":4,"namespace":"Reentry","components":[{"name":"Plate"},{"name":"Screen"},{"name":"Button"},{"name":"Switch"},{"name":"Gauge"},{"name":"SegmentBar"},{"name":"Tabs"},{"name":"TextField"},{"name":"Slider"},{"name":"Hazard"},{"name":"Lamp"},{"name":"TitleCard"},{"name":"Icon"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var ICONS = {"reticle": [["M5 12a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5", "stroke"], ["M10.6 12a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0", "fill"]], "altitude": [["M4 20.5h16M8 17V7.5M8 7.5L5 10.5M8 7.5l3 3M16 17V4", "stroke"], ["M14 4h4v2h-4zM14 8.5h4v2h-4zM14 13h4v2h-4z", "fill"]], "speed": [["M3.5 14L3.57 12.89L3.79 11.8L4.15 10.75L4.64 9.75L5.26 8.83L5.99 7.99L6.83 7.26L7.75 6.64L8.75 6.15L9.8 5.79L10.89 5.57L12 5.5L13.11 5.57L14.2 5.79L15.25 6.15L16.25 6.64L17.17 7.26L18.01 7.99L18.74 8.83L19.36 9.75L19.85 10.75L20.21 11.8L20.43 12.89L20.5 14M3.5 14h2M20.5 14h-2M12 5.5v2M6 8l1.4 1.4M18 8l-1.4 1.4M12 14l4.5-4.5", "stroke"], ["M10.2 14a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0", "fill"]], "thrust": [["M9 3h6v3.5h-6zM10 6.5L6.5 14h11L14 6.5", "stroke"], ["M12 22c-3.2-2.2-3.8-4.6-2.2-7h4.4c1.6 2.4 1 4.8-2.2 7z", "fill"]], "fuel": [["M5 20.5V5.5l2-2h6l2 2v15zM15 9.5h2.5l1.5 1.5v6.5a1.5 1.5 0 0 0 3 0V8l-2.5-2.5M3.5 20.5h13", "stroke"], ["M7.5 6.5h5v4h-5z", "fill"]], "shield": [["M12 2.5l8 3v6c0 4.6-3.3 8.4-8 10-4.7-1.6-8-5.4-8-10v-6z", "stroke"], ["M12 6.5l4.5 1.7v3.6c0 2.6-1.8 4.8-4.5 6z", "fill"]], "heat": [["M10 14.6V5a2 2 0 0 1 4 0v9.6a4 4 0 1 1-4 0zM16.5 6h3M16.5 9.5h3M16.5 13h3", "stroke"], ["M10.1 17.8a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0 -3.8 0M11.1 9h1.8v7h-1.8z", "fill"]], "radar": [["M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0M12 12l6.4-6.4", "stroke"], ["M13.8 15.6a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0M6.9 8.6a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0", "fill"]], "signal": [["M12 11v10.5M8.5 21.5h7M8.2 7.2a5.4 5.4 0 0 0 0 7.6M15.8 7.2a5.4 5.4 0 0 1 0 7.6M5.4 4.4a9.4 9.4 0 0 0 0 13.2M18.6 4.4a9.4 9.4 0 0 1 0 13.2", "stroke"], ["M10.2 11a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0", "fill"]], "pod": [["M12 2.5l5.5 4.5v9l-2 3h-7l-2-3V7zM6.5 16h11M9.5 19.5L8 21.5M14.5 19.5l1.5 2", "stroke"], ["M10.2 8.2h3.6v3.6h-3.6z", "fill"]], "parachute": [["M3 11a9 7.5 0 0 1 18 0zM3 11l7.5 8M21 11l-7.5 8M9 11l2 8M15 11l-2 8M10 19h4v2.5h-4z", "stroke"]], "horizon": [["M3 19L3.32 18.31L3.69 17.64L4.12 17.01L4.59 16.41L5.11 15.85L5.68 15.33L6.28 14.86L6.91 14.43L7.58 14.06L8.27 13.74L8.99 13.48L9.73 13.27L10.48 13.12L11.24 13.03L12 13L12.76 13.03L13.52 13.12L14.27 13.27L15.01 13.48L15.73 13.74L16.42 14.06L17.09 14.43L17.72 14.86L18.32 15.33L18.89 15.85L19.41 16.41L19.88 17.01L20.31 17.64L20.68 18.31L21 19M2.5 19h19", "stroke"], ["M14.2 6.2a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0", "fill"], ["M4.2 13.6l1.4 1.2M7.6 10.4l.9 1.6M12 9.3v1.8M16.4 10.4l-.9 1.6M19.8 13.6l-1.4 1.2", "stroke"]], "satellite": [["M9.5 9.5h5v5h-5zM2.5 10h4.5v4H2.5zM17 10h4.5v4H17zM7 12h2.5M14.5 12H17M12 9.5V6.5M10 4.5a2.8 2.8 0 0 1 4 0", "stroke"], ["M11 6.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0", "fill"]], "helmet": [["M4 13a8 8 0 0 1 16 0v4.5l-2 3H6l-2-3zM6.5 12.5h11l-1 4h-9z", "stroke"], ["M13.5 13.5h2.5l-.6 2h-2.3z", "fill"]], "power": [["M7.4 6.4a7.5 7.5 0 1 0 9.2 0M12 3v8", "stroke"]], "lock": [["M5 10.5h14v10H5zM8 10.5V7a4 4 0 0 1 8 0v3.5", "stroke"], ["M11 14h2v3.5h-2z", "fill"]], "eject": [["M4.5 16.5h15M4.5 20.5h15", "stroke"], ["M12 3.5l7.5 9h-15z", "fill"]], "warning": [["M12 3l9.5 17.5h-19zM12 9.5V15", "stroke"], ["M11 16.8h2v2h-2z", "fill"]], "info": [["M6.5 3L17.5 3L21 6.5L21 17.5L17.5 21L6.5 21L3 17.5L3 6.5zM12 10.5V17", "stroke"], ["M11 6.8h2v2h-2z", "fill"]], "check": [["M4.5 12.5l5 5 10-10", "stroke"]], "close": [["M5.5 5.5l13 13M18.5 5.5l-13 13", "stroke"]], "plus": [["M12 4v16M4 12h16", "stroke"]], "menu": [["M3.5 6.5h17M3.5 12h17M3.5 17.5h11", "stroke"]], "settings": [["M12.71 4.83L14.73 3L16.43 3.71L16.57 6.43L17.57 7.43L20.29 7.57L21 9.27L19.17 11.29L19.17 12.71L21 14.73L20.29 16.43L17.57 16.57L16.57 17.57L16.43 20.29L14.73 21L12.71 19.17L11.29 19.17L9.27 21L7.57 20.29L7.43 17.57L6.43 16.57L3.71 16.43L3 14.73L4.83 12.71L4.83 11.29L3 9.27L3.71 7.57L6.43 7.43L7.43 6.43L7.57 3.71L9.27 3L11.29 4.83zM9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0", "stroke"]], "arrow-right": [["M3.5 12h16M13.5 6l6 6-6 6", "stroke"]], "arrow-left": [["M20.5 12h-16M10.5 6l-6 6 6 6", "stroke"]], "chevron-right": [["M9 5l7 7-7 7", "stroke"]], "play": [["M7 4v16l13-8z", "stroke"]]};

  function cx() { var o = []; for (var i = 0; i < arguments.length; i++) if (arguments[i]) o.push(arguments[i]); return o.join(" "); }
  function rest(p, omit) { var o = {}; for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k) && omit.indexOf(k) < 0) o[k] = p[k]; return o; }
  var fid = 0;
  function useId(given, pre) { var r = React.useRef(null); if (!r.current) r.current = given || "re-" + pre + "-" + (++fid); return r.current; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function Icon(props) {
    var size = props.size || 20;
    return h("svg", { className: cx("re-icon", props.className), viewBox: "0 0 24 24", width: size, height: size,
      role: props.label ? "img" : undefined, "aria-label": props.label || undefined, "aria-hidden": props.label ? undefined : true },
      (ICONS[props.name] || []).map(function (p, i) {
        return p[1] === "stroke"
          ? h("path", { key: i, d: p[0], fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "square", strokeLinejoin: "miter" })
          : h("path", { key: i, d: p[0], fill: "currentColor" });
      }));
  }

  function Screws() {
    return [h("span", { key: 1, className: "re-screw re-s-tl", "aria-hidden": true }), h("span", { key: 2, className: "re-screw re-s-tr", "aria-hidden": true }),
      h("span", { key: 3, className: "re-screw re-s-bl", "aria-hidden": true }), h("span", { key: 4, className: "re-screw re-s-br", "aria-hidden": true })];
  }

  function Plate(props) {
    var attrs = Object.assign({}, rest(props, ["title", "code", "stripe", "className", "children", "footer"]), {
      className: cx("re-plate", props.stripe ? "re-plate-stripe" : null, props.className), "aria-label": props.title
    });
    return h("section", attrs, Screws(),
      props.title || props.code ? h("header", { className: "re-plate-head" },
        props.title ? h("h3", { className: "re-plate-title" }, props.title) : null,
        props.code ? h("span", { className: "re-plate-code" }, props.code) : null) : null,
      h("div", { className: "re-plate-body" }, props.children),
      props.footer ? h("footer", { className: "re-plate-foot" }, props.footer) : null);
  }

  function Screen(props) {
    return h("div", { className: cx("re-screen", props.alert ? "re-screen-alert" : null, props.className), role: props.live ? "status" : undefined },
      h("div", { className: "re-screen-glass" },
        props.title || props.status ? h("div", { className: "re-screen-top" },
          h("span", null, props.title), props.status ? h("span", { className: "re-screen-status" }, props.status) : null) : null,
        h("div", { className: "re-screen-body" }, props.children, props.cursor ? h("span", { className: "re-cursor", "aria-hidden": true }) : null)));
  }

  function Button(props) {
    var v = props.variant || "solid", tone = props.tone || "amber", size = props.size || "md";
    var attrs = Object.assign({ type: "button" }, rest(props, ["variant", "tone", "size", "icon", "className", "children"]), {
      className: cx("re-key", "re-key-" + v, "re-t-" + tone, "re-key-" + size, props.className)
    });
    return h("button", attrs, props.icon ? h(Icon, { name: props.icon, size: size === "sm" ? 16 : 18 }) : null, h("span", { className: "re-key-label" }, props.children));
  }

  function Switch(props) {
    var st = React.useState(!!props.defaultChecked);
    var on = props.checked == null ? st[0] : props.checked;
    var id = useId(props.id, "sw");
    function flip() { if (props.disabled) return; st[1](!on); if (props.onChange) props.onChange(!on); }
    return h("div", { className: cx("re-switch", on ? "re-switch-on" : null, props.disabled ? "re-disabled" : null, props.className) },
      h("button", { id: id, type: "button", role: "switch", "aria-checked": on, disabled: props.disabled, className: "re-switch-track", onClick: flip },
        h("span", { className: "re-switch-lever", "aria-hidden": true })),
      h("label", { htmlFor: id, className: "re-switch-label" }, props.label),
      h("span", { className: "re-switch-state", "aria-hidden": true }, h("span", { className: "re-lamp-lens" }), on ? (props.onText || "ON") : (props.offText || "OFF")));
  }

  function Gauge(props) {
    var min = props.min == null ? 0 : props.min, max = props.max == null ? 100 : props.max, v = clamp(props.value == null ? min : props.value, min, max);
    var red = props.redline == null ? null : props.redline, size = props.size || 168;
    var fmt = props.format || function (x) { return String(Math.round(x)); };
    var A0 = 135, SWEEP = 270, R = 70, C = 84;
    function pt(frac, r) { var a = (A0 + SWEEP * frac) * Math.PI / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)]; }
    function arcd(f0, f1, r) { var p0 = pt(f0, r), p1 = pt(f1, r), large = (f1 - f0) * SWEEP > 180 ? 1 : 0; return "M" + p0[0].toFixed(2) + " " + p0[1].toFixed(2) + "A" + r + " " + r + " 0 " + large + " 1 " + p1[0].toFixed(2) + " " + p1[1].toFixed(2); }
    var ticks = [];
    for (var i = 0; i <= 20; i++) { var fr = i / 20, major = i % 4 === 0, a = pt(fr, R - 2), b = pt(fr, major ? R - 13 : R - 8);
      ticks.push(h("line", { key: i, x1: a[0], y1: a[1], x2: b[0], y2: b[1], className: cx("re-g-tick", major ? "re-g-major" : null, red != null && fr >= red ? "re-g-hot" : null) })); }
    var nums = [];
    for (var j = 0; j <= 5; j++) { var q = pt(j / 5, R - 27); nums.push(h("text", { key: j, x: q[0], y: q[1] + 4.5, className: "re-g-num", textAnchor: "middle" }, fmt(min + (max - min) * j / 5))); }
    var frac = (v - min) / (max - min), tip = pt(frac, R - 10), tail = pt(frac + 0.5, 12);
    var hot = red != null && frac >= red;
    return h("div", { className: cx("re-gauge", hot ? "re-gauge-hot" : null, props.className), role: "meter", "aria-valuemin": min, "aria-valuemax": max, "aria-valuenow": v,
      "aria-valuetext": fmt(v) + (props.unit ? " " + props.unit : ""), "aria-label": props.label, style: { width: size } },
      h("svg", { viewBox: "0 0 168 168", width: size, height: size, "aria-hidden": true },
        h("circle", { cx: C, cy: C, r: 82, className: "re-g-bezel" }),
        h("circle", { cx: C, cy: C, r: 76, className: "re-g-face" }),
        h("path", { d: arcd(0, red == null ? 1 : red, R), className: "re-g-arc" }),
        red != null ? h("path", { d: arcd(red, 1, R), className: "re-g-arc re-g-arc-hot" }) : null,
        ticks, nums,
        h("line", { x1: tail[0], y1: tail[1], x2: tip[0], y2: tip[1], className: "re-g-needle" }),
        h("circle", { cx: C, cy: C, r: 7, className: "re-g-cap" }),
        h("rect", { x: 46, y: 124, width: 76, height: 24, rx: 3, className: "re-g-window" }),
        h("text", { x: C, y: 141, textAnchor: "middle", className: "re-g-val" }, fmt(v), props.unit ? h("tspan", { className: "re-g-unit", dx: 3 }, props.unit) : null)),
      props.label ? h("div", { className: "re-label re-gauge-label", "aria-hidden": true }, props.label) : null);
  }

  function SegmentBar(props) {
    var n = props.segments || 20, v = clamp(props.value || 0, 0, 100), lit = Math.round(v / 100 * n);
    var warn = props.warnBelow == null ? 25 : props.warnBelow;
    var tone = props.tone || (v <= warn ? "red" : "amber");
    var segs = [];
    for (var i = 0; i < n; i++) segs.push(h("span", { key: i, className: cx("re-seg", i < lit ? "re-seg-on" : null) }));
    return h("div", { className: cx("re-segbar", "re-t-" + tone, props.className) },
      h("div", { className: "re-segbar-head" }, h("span", { className: "re-label" }, props.label), h("span", { className: "re-segbar-val" }, (props.format ? props.format(v) : Math.round(v) + "%"))),
      h("div", { className: "re-segbar-track", role: "meter", "aria-label": props.label, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": v,
        "aria-valuetext": (props.format ? props.format(v) : Math.round(v) + "%") + (v <= warn ? ", low" : "") }, segs));
  }

  function Tabs(props) {
    var tabs = props.tabs || [], id = useId(props.id, "tabs");
    var st = React.useState(props.defaultValue || 0);
    var cur = props.value == null ? st[0] : props.value;
    function pick(i) { st[1](i); if (props.onChange) props.onChange(i); }
    function key(e, i) {
      var n = tabs.length, j = null;
      if (e.key === "ArrowRight") j = (i + 1) % n; else if (e.key === "ArrowLeft") j = (i - 1 + n) % n; else if (e.key === "Home") j = 0; else if (e.key === "End") j = n - 1;
      if (j != null) { e.preventDefault(); pick(j); var el = document.getElementById(id + "-t" + j); if (el) el.focus(); }
    }
    return h("div", { className: cx("re-tabs", props.className) },
      h("div", { className: "re-tablist", role: "tablist", "aria-label": props.label },
        tabs.map(function (t, i) {
          var o = typeof t === "object" ? t : { label: t };
          return h("button", { key: i, id: id + "-t" + i, role: "tab", type: "button", "aria-selected": cur === i, "aria-controls": id + "-p", tabIndex: cur === i ? 0 : -1,
            className: cx("re-tab", cur === i ? "re-tab-on" : null), onClick: function () { pick(i); }, onKeyDown: function (e) { key(e, i); } },
            h("span", { className: "re-tab-lamp", "aria-hidden": true }),
            o.icon ? h(Icon, { name: o.icon, size: 18 }) : null, h("span", null, o.label));
        })),
      props.children ? h("div", { className: "re-tabpanel", id: id + "-p", role: "tabpanel", "aria-labelledby": id + "-t" + cur, tabIndex: 0 },
        typeof props.children === "function" ? props.children(cur) : props.children) : null);
  }

  function TextField(props) {
    var id = useId(props.id, "f"), mid = id + "-m";
    var msg = props.error || props.hint;
    return h("div", { className: cx("re-field", props.error ? "re-field-err" : null, props.className) },
      props.label ? h("label", { className: "re-label", htmlFor: id }, props.label) : null,
      h("div", { className: "re-well" },
        props.icon ? h(Icon, { name: props.icon, size: 18 }) : null,
        h("input", Object.assign(rest(props, ["label", "icon", "hint", "error", "className", "id"]), { id: id, className: "re-input",
          "aria-invalid": props.error ? true : undefined, "aria-describedby": msg ? mid : undefined }))),
      msg ? h("span", { id: mid, className: cx("re-msg", props.error ? "re-msg-err" : null) }, props.error ? h(Icon, { name: "warning", size: 14 }) : null, msg) : null);
  }

  function Slider(props) {
    var min = props.min == null ? 0 : props.min, max = props.max == null ? 100 : props.max;
    var st = React.useState(props.defaultValue == null ? min : props.defaultValue);
    var v = props.value == null ? st[0] : props.value;
    var fmt = props.format || function (x) { return String(x); };
    var id = useId(props.id, "s");
    var marks = props.marks || 5, scale = [];
    for (var i = 0; i < marks; i++) scale.push(h("span", { key: i, style: { left: (i / (marks - 1) * 100) + "%" } }, fmt(Math.round(min + (max - min) * i / (marks - 1)))));
    return h("div", { className: cx("re-slider", "re-t-" + (props.tone || "amber"), props.className) },
      h("div", { className: "re-slider-head" },
        props.label ? h("label", { className: "re-label", htmlFor: id }, props.label) : h("span"),
        h("output", { className: "re-slider-val", htmlFor: id }, fmt(v))),
      h("input", Object.assign(rest(props, ["label", "className", "value", "defaultValue", "onChange", "format", "tone", "id", "marks"]), {
        id: id, type: "range", min: min, max: max, value: v, className: "re-range", "aria-valuetext": fmt(v),
        style: { "--re-fill": ((v - min) / (max - min) * 100) + "%" },
        onChange: function (e) { st[1](Number(e.target.value)); if (props.onChange) props.onChange(e); }
      })),
      h("div", { className: "re-slider-scale", "aria-hidden": true }, scale));
  }

  function Hazard(props) {
    var tone = props.tone || "caution";
    return h("div", { className: cx("re-hazard", "re-hazard-" + tone, props.className), role: props.live ? (tone === "alert" ? "alert" : "status") : undefined },
      h("span", { className: "re-hazard-icon" }, h(Icon, { name: props.icon || "warning", size: 22 })),
      h("div", { className: "re-hazard-text" }, props.title ? h("strong", { className: "re-hazard-title" }, props.title) : null, props.children ? h("span", null, props.children) : null),
      props.action || null);
  }

  function Lamp(props) {
    var state = props.state || "on";
    return h("span", { className: cx("re-lamp", "re-lamp-" + (props.color || "green"), "re-lamp-" + state, props.className) },
      h("span", { className: "re-lamp-lens", "aria-hidden": true }), h("span", { className: "re-lamp-label" }, props.children),
      h("span", { className: "re-sr" }, state === "off" ? " (off)" : state === "blink" ? " (warning)" : " (on)"));
  }

  function TitleCard(props) {
    return h("div", { className: cx("re-titlecard", props.className) },
      props.kicker ? h("div", { className: "re-tc-kicker" }, props.kicker) : null,
      h(props.as || "h2", { className: "re-tc-title" }, props.title),
      props.subtitle ? h("div", { className: "re-tc-sub" }, props.subtitle) : null);
  }

  window.Reentry = Object.assign(window.Reentry || {}, {
    Plate: Plate, Screen: Screen, Button: Button, Switch: Switch, Gauge: Gauge, SegmentBar: SegmentBar, Tabs: Tabs, TextField: TextField,
    Slider: Slider, Hazard: Hazard, Lamp: Lamp, TitleCard: TitleCard, Icon: Icon, iconNames: Object.keys(ICONS)
  });
})();
