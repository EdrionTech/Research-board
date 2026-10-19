/* @ds-bundle: {"format":4,"namespace":"Astrolabe","components":[{"name":"Panel"},{"name":"Button"},{"name":"OrbitButton"},{"name":"MoonToggle"},{"name":"Constellation"},{"name":"Tabs"},{"name":"SpectralTag"},{"name":"Readout"},{"name":"TextField"},{"name":"Slider"},{"name":"Icon"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var ICONS = {"planet": [["M6.8 12a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0 -10.4 0M21.02 8.72L21.07 8.92L21.09 9.14L21.06 9.37L21 9.61L20.89 9.86L20.75 10.12L20.57 10.39L20.36 10.66L20.11 10.94L19.82 11.23L19.5 11.51L19.15 11.8L18.77 12.1L18.36 12.39L17.92 12.68L17.46 12.96L16.97 13.24L16.46 13.52L15.94 13.79L15.39 14.05L14.83 14.31L14.26 14.55L13.68 14.79L13.09 15.01L12.5 15.22L11.91 15.41L11.31 15.59L10.72 15.75L10.14 15.9L9.56 16.03L8.99 16.15L8.44 16.25L7.9 16.32L7.38 16.38L6.87 16.43L6.4 16.45L5.94 16.45L5.51 16.44L5.11 16.4L4.73 16.35L4.39 16.27L4.08 16.18L3.81 16.08L3.57 15.95L3.37 15.81L3.2 15.65L3.07 15.47L2.98 15.28L2.93 15.08L2.91 14.86L2.94 14.63L3 14.39L3.11 14.14L3.25 13.88L3.43 13.61L3.64 13.34L3.89 13.06L4.18 12.77L4.5 12.49L4.85 12.2L5.23 11.9L5.64 11.61M16.62 7.62L17.13 7.57L17.6 7.55L18.06 7.55L18.49 7.56L18.89 7.6L19.27 7.65L19.61 7.73L19.92 7.82L20.19 7.92L20.43 8.05L20.63 8.19L20.8 8.35L20.93 8.53L21.02 8.72", "stroke"]], "star": [["M12 2.8Q13.66 10.34 21.2 12Q13.66 13.66 12 21.2Q10.34 13.66 2.8 12Q10.34 10.34 12 2.8z", "stroke"]], "stars": [["M10 6.3Q11.3 12.2 17.2 13.5Q11.3 14.8 10 20.7Q8.7 14.8 2.8 13.5Q8.7 12.2 10 6.3z", "stroke"], ["M18.6 2.8Q19.17 4.83 21.2 5.4Q19.17 5.97 18.6 8Q18.03 5.97 16 5.4Q18.03 4.83 18.6 2.8z", "fill"]], "moon": [["M19.18 15.37A8.2 8.2 0 1 1 10.77 4.33A7 7 0 1 0 19.18 15.37z", "stroke"], ["M18.2 13.7Q18.62 15.18 20.1 15.6Q18.62 16.02 18.2 17.5Q17.78 16.02 16.3 15.6Q17.78 15.18 18.2 13.7z", "fill"]], "sun": [["M7.7 12a4.3 4.3 0 1 0 8.6 0a4.3 4.3 0 1 0 -8.6 0M18.8 12L21.2 12M16.81 16.81L18.51 18.51M12 18.8L12 21.2M7.19 16.81L5.49 18.51M5.2 12L2.8 12M7.19 7.19L5.49 5.49M12 5.2L12 2.8M16.81 7.19L18.51 5.49", "stroke"]], "eclipse": [["M3.4 12a8.6 8.6 0 1 0 17.2 0a8.6 8.6 0 1 0 -17.2 0", "stroke"], ["M17.07 15.21A6 6 0 1 1 10.51 6.19A5.6 5.6 0 1 0 17.07 15.21z", "fill"]], "comet": [["M12.6 7.8a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0 -7.2 0M13.4 10.4L4 19.8M12.4 7.4L6.2 13.6M16.8 11.6L10.8 17.6", "stroke"]], "galaxy": [["M13.2 12L13.32 12.12L13.42 12.27L13.5 12.44L13.54 12.63L13.54 12.82L13.5 13.03L13.42 13.24L13.29 13.45L13.12 13.65L12.91 13.84L12.65 14.02L12.35 14.17L12.02 14.29L11.65 14.38L11.25 14.43L10.84 14.44L10.41 14.4L9.98 14.32L9.55 14.19L9.13 14.02L8.73 13.79L8.36 13.52L8.02 13.21L7.74 12.85L7.51 12.46L7.33 12.04L7.23 11.59L7.2 11.12L7.24 10.64L7.37 10.16L7.57 9.68L7.86 9.21L8.23 8.77L8.68 8.35L9.2 7.98L9.79 7.65L10.44 7.37L11.15 7.16L11.9 7.01L12.68 6.93L13.49 6.93L14.3 7.01L15.12 7.17L15.91 7.41L16.68 7.73L17.4 8.13L18.06 8.6L18.66 9.14L19.18 9.75L19.6 10.41L19.92 11.12L20.13 11.87L20.23 12.64L20.2 13.43L20.04 14.22L19.76 15.01L19.36 15.77L18.82 16.5L18.17 17.18L17.41 17.81M10.8 12L10.68 11.88L10.58 11.73L10.5 11.56L10.46 11.37L10.46 11.18L10.5 10.97L10.58 10.76L10.71 10.55L10.88 10.35L11.09 10.16L11.35 9.98L11.65 9.83L11.98 9.71L12.35 9.62L12.75 9.57L13.16 9.56L13.59 9.6L14.02 9.68L14.45 9.81L14.87 9.98L15.27 10.21L15.64 10.48L15.98 10.79L16.26 11.15L16.49 11.54L16.67 11.96L16.77 12.41L16.8 12.88L16.76 13.36L16.63 13.84L16.43 14.32L16.14 14.79L15.77 15.23L15.32 15.65L14.8 16.02L14.21 16.35L13.56 16.63L12.85 16.84L12.1 16.99L11.32 17.07L10.51 17.07L9.7 16.99L8.88 16.83L8.09 16.59L7.32 16.27L6.6 15.87L5.94 15.4L5.34 14.86L4.82 14.25L4.4 13.59L4.08 12.88L3.87 12.13L3.77 11.36L3.8 10.57L3.96 9.78L4.24 8.99L4.64 8.23L5.18 7.5L5.83 6.82L6.59 6.19", "stroke"], ["M10.5 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0", "fill"]], "orbit": [["M20.34 8.11L20.46 8.49L20.51 8.89L20.47 9.33L20.35 9.8L20.15 10.28L19.87 10.78L19.52 11.29L19.09 11.81L18.6 12.34L18.04 12.85L17.42 13.36L16.75 13.86L16.04 14.34L15.28 14.8L14.5 15.23L13.69 15.63L12.87 15.99L12.03 16.31L11.2 16.6L10.37 16.84L9.56 17.03L8.77 17.17L8.02 17.27L7.3 17.31L6.63 17.31L6.01 17.25L5.44 17.14L4.94 16.98L4.51 16.77L4.15 16.52L3.87 16.22L3.66 15.89L3.54 15.51L3.49 15.11L3.53 14.67L3.65 14.2L3.85 13.72L4.13 13.22L4.48 12.71L4.91 12.19L5.4 11.66L5.96 11.15L6.58 10.64L7.25 10.14L7.96 9.66L8.72 9.2L9.5 8.77L10.31 8.37L11.13 8.01L11.97 7.69L12.8 7.4L13.63 7.16L14.44 6.97L15.23 6.83L15.98 6.73L16.7 6.69L17.37 6.69L17.99 6.75L18.56 6.86L19.06 7.02L19.49 7.23L19.85 7.48L20.13 7.78L20.34 8.11zM9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0", "stroke"], ["M17.39 11.81a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0", "fill"]], "constellation": [["M3.8 18.2L9 12.4l5.2 2.4 6-9.2", "stroke"], ["M2.1 18.2a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0M7.3 12.4a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0M12.5 14.8a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0M18.5 5.6a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0", "fill"]], "telescope": [["M3.6 13.6L16.2 7.2L18 10.8L5.4 17.2zM16.2 7.2L19.6 5.5L21.4 9.1L18 10.8zM11.4 13.4L7.6 21M11.4 13.4L15.2 21", "stroke"]], "rocket": [["M12 2.6C15.4 5 16.4 8.8 16.4 12.8V17H7.6v-4.2C7.6 8.8 8.6 5 12 2.6zM10.1 10a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0 -3.8 0M7.6 13.2L4.8 16.4v3l2.8-1.6M16.4 13.2l2.8 3.2v3l-2.8-1.6M10.4 20l1.6 1.8 1.6-1.8", "stroke"]], "satellite": [["M9 9h6v6H9zM2.6 9.2h4.6v5.6H2.6zM16.8 9.2h4.6v5.6h-4.6zM7.2 12H9M15 12h1.8M4.9 9.2v5.6M19.1 9.2v5.6M12 9V5.4", "stroke"], ["M10.5 4.2a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0", "fill"]], "astrolabe": [["M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0M12 3v4M12 17v4M3 12h4M17 12h4M8.5 15.5l7-7", "stroke"], ["M10.6 12a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0", "fill"]], "compass": [["M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M12 5.8L14.2 12L12 18.2L9.8 12z", "stroke"], ["M12 5.8L14.2 12L9.8 12z", "fill"]], "search": [["M4 10.6a6.6 6.6 0 1 0 13.2 0a6.6 6.6 0 1 0 -13.2 0M15.4 15.4L20.8 20.8", "stroke"], ["M10.6 8Q11.17 10.03 13.2 10.6Q11.17 11.17 10.6 13.2Q10.03 11.17 8 10.6Q10.03 10.03 10.6 8z", "fill"]], "settings": [["M12 4.8L13.79 2.98L15.52 3.5L16 6.01L17.09 6.91L19.65 6.89L20.5 8.48L19.06 10.6L19.2 12L21.02 13.79L20.5 15.52L17.99 16L17.09 17.09L17.11 19.65L15.52 20.5L13.4 19.06L12 19.2L10.21 21.02L8.48 20.5L8 17.99L6.91 17.09L4.35 17.11L3.5 15.52L4.94 13.4L4.8 12L2.98 10.21L3.5 8.48L6.01 8L6.91 6.91L6.89 4.35L8.48 3.5L10.6 4.94zM9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0", "stroke"]], "menu": [["M4 7h16M4 12h16M4 17h10", "stroke"]], "close": [["M6.2 6.2l11.6 11.6M17.8 6.2L6.2 17.8", "stroke"]], "check": [["M4.8 12.6l4.6 4.6 9.8-10", "stroke"]], "plus": [["M12 4.6v14.8M4.6 12h14.8", "stroke"]], "arrow-right": [["M4 12h15.4M13.8 6.4l5.6 5.6-5.6 5.6", "stroke"]], "arrow-left": [["M20 12H4.6M10.2 6.4L4.6 12l5.6 5.6", "stroke"]], "chevron-right": [["M9 5.8l6.2 6.2L9 18.2", "stroke"]], "play": [["M8 5.2v13.6c0 .6.6.9 1.1.6l10.2-6.8c.4-.3.4-.9 0-1.2L9.1 4.6C8.6 4.3 8 4.6 8 5.2z", "stroke"]], "pause": [["M8.5 5v14M15.5 5v14", "stroke"]], "info": [["M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M12 10.8v6", "stroke"], ["M10.8 7.6a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0", "fill"]], "warning": [["M10.6 4.2a1.6 1.6 0 0 1 2.8 0l8 14.2a1.6 1.6 0 0 1-1.4 2.4H4a1.6 1.6 0 0 1-1.4-2.4zM12 9.8v4.6", "stroke"], ["M10.9 17.2a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0", "fill"]]};

  function cx() { var o = []; for (var i = 0; i < arguments.length; i++) if (arguments[i]) o.push(arguments[i]); return o.join(" "); }
  function rest(p, omit) { var o = {}; for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k) && omit.indexOf(k) < 0) o[k] = p[k]; return o; }

  function Icon(props) {
    var size = props.size || 20;
    return h("svg", { className: cx("as-icon", props.className), viewBox: "0 0 24 24", width: size, height: size,
      role: props.label ? "img" : undefined, "aria-label": props.label || undefined, "aria-hidden": props.label ? undefined : true },
      (ICONS[props.name] || []).map(function (p, i) {
        return p[1] === "stroke"
          ? h("path", { key: i, d: p[0], fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" })
          : h("path", { key: i, d: p[0], fill: "currentColor" });
      }));
  }

  function Panel(props) {
    var attrs = Object.assign({}, rest(props, ["title", "coords", "halo", "className", "children", "footer"]), {
      className: cx("as-panel", props.halo ? "as-panel-halo" : null, props.className), "aria-label": props.title
    });
    return h("section", attrs,
      h("span", { className: "as-cross as-x-tl", "aria-hidden": true }), h("span", { className: "as-cross as-x-tr", "aria-hidden": true }),
      h("span", { className: "as-cross as-x-bl", "aria-hidden": true }), h("span", { className: "as-cross as-x-br", "aria-hidden": true }),
      props.title || props.coords ? h("header", { className: "as-panel-head" },
        props.title ? h("h3", { className: "as-panel-title" }, props.title) : null,
        props.coords ? h("span", { className: "as-coords" }, props.coords) : null) : null,
      h("div", { className: "as-ticks", "aria-hidden": true }),
      h("div", { className: "as-panel-body" }, props.children),
      props.footer ? h("footer", { className: "as-panel-foot" }, props.footer) : null);
  }

  function Button(props) {
    var v = props.variant || "solid", tone = props.tone || "star", size = props.size || "md";
    var attrs = Object.assign({ type: "button" }, rest(props, ["variant", "tone", "size", "icon", "orbit", "className", "children"]), {
      className: cx("as-btn", "as-btn-" + v, "as-t-" + tone, "as-btn-" + size, props.orbit ? "as-btn-orbit" : null, props.className)
    });
    return h("button", attrs,
      props.orbit ? h("span", { className: "as-btn-ring", "aria-hidden": true }, h("span", { className: "as-btn-moon" })) : null,
      props.icon ? h(Icon, { name: props.icon, size: 18 }) : null,
      h("span", { className: "as-btn-label" }, props.children));
  }

  function OrbitButton(props) {
    var size = props.size || "md";
    var attrs = Object.assign({ type: "button" }, rest(props, ["icon", "label", "tone", "size", "className"]), {
      className: cx("as-orb", "as-t-" + (props.tone || "star"), "as-orb-" + size, props.className), "aria-label": props.label
    });
    return h("button", attrs,
      h("span", { className: "as-orb-ring", "aria-hidden": true }, h("span", { className: "as-orb-moon" })),
      h(Icon, { name: props.icon, size: size === "lg" ? 28 : size === "sm" ? 18 : 22 }));
  }

  function MoonToggle(props) {
    var st = React.useState(!!props.defaultChecked);
    var on = props.checked == null ? st[0] : props.checked;
    function flip() { st[1](!on); if (props.onChange) props.onChange(!on); }
    return h("label", { className: cx("as-moon", on ? "as-moon-on" : null, props.disabled ? "as-disabled" : null, props.className) },
      h("button", { type: "button", role: "switch", "aria-checked": on, disabled: props.disabled, className: "as-moon-track", onClick: flip },
        h("span", { className: "as-moon-stars", "aria-hidden": true }),
        h("span", { className: "as-moon-thumb", "aria-hidden": true })),
      props.label ? h("span", { className: "as-moon-label" }, props.label) : null);
  }

  function Constellation(props) {
    var steps = props.steps || [], cur = props.current || 0;
    return h("div", { className: cx("as-const-wrap", props.className) }, h("ol", { className: "as-const", "aria-label": props.label || "Progress" },
      steps.map(function (s, i) {
        var state = i < cur ? "done" : i === cur ? "now" : "next";
        return h("li", { key: i, className: cx("as-const-step", "as-const-" + state), "aria-current": state === "now" ? "step" : undefined },
          h("span", { className: "as-const-star", "aria-hidden": true }),
          h("span", { className: "as-const-label" }, s),
          h("span", { className: "as-sr" }, state === "done" ? " (done)" : state === "now" ? " (current)" : ""));
      })));
  }

  function Tabs(props) {
    var tabs = props.tabs || [], id = props.id || "as-tabs";
    var st = React.useState(props.defaultValue || 0);
    var cur = props.value == null ? st[0] : props.value;
    function pick(i) { st[1](i); if (props.onChange) props.onChange(i); }
    function key(e, i) {
      var n = tabs.length, j = null;
      if (e.key === "ArrowRight") j = (i + 1) % n; else if (e.key === "ArrowLeft") j = (i - 1 + n) % n; else if (e.key === "Home") j = 0; else if (e.key === "End") j = n - 1;
      if (j != null) { e.preventDefault(); pick(j); var el = document.getElementById(id + "-t" + j); if (el) el.focus(); }
    }
    return h("div", { className: cx("as-tabs", props.className) },
      h("div", { className: "as-tablist", role: "tablist", "aria-label": props.label },
        tabs.map(function (t, i) {
          return h("button", { key: i, id: id + "-t" + i, role: "tab", type: "button", "aria-selected": cur === i, tabIndex: cur === i ? 0 : -1,
            className: cx("as-tab", cur === i ? "as-tab-on" : null), onClick: function () { pick(i); }, onKeyDown: function (e) { key(e, i); } },
            typeof t === "object" && t.icon ? h(Icon, { name: t.icon, size: 18 }) : null,
            h("span", { className: "as-tab-label" }, typeof t === "object" ? t.label : t),
            cur === i ? h("span", { className: "as-tab-moon", "aria-hidden": true }) : null);
        })),
      props.children ? h("div", { className: "as-tabpanel", role: "tabpanel", "aria-labelledby": id + "-t" + cur }, typeof props.children === "function" ? props.children(cur) : props.children) : null);
  }

  var SPEC = { O: "Blue giant", B: "Blue-white", A: "White", F: "Yellow-white", G: "Yellow, like the Sun", K: "Orange", M: "Red dwarf" };
  function SpectralTag(props) {
    var c = (props.cls || "G").charAt(0).toUpperCase();
    return h("span", { className: cx("as-spec", "as-spec-" + c, props.className), title: SPEC[c] },
      h("span", { className: "as-spec-dot", "aria-hidden": true }),
      h("span", { className: "as-spec-cls" }, props.cls || c),
      props.children ? h("span", { className: "as-spec-text" }, props.children) : null);
  }

  function Readout(props) {
    return h("div", { className: cx("as-readout", "as-t-" + (props.tone || "star"), props.className) },
      h("span", { className: "as-label" }, props.label),
      h("span", { className: "as-readout-val" }, props.value, props.unit ? h("small", null, props.unit) : null),
      props.caption ? h("span", { className: "as-readout-cap" }, props.caption) : null);
  }

  var fid = 0;
  function TextField(props) {
    var r = React.useRef(null); if (!r.current) r.current = props.id || "as-f-" + (++fid);
    return h("div", { className: cx("as-field", props.error ? "as-field-err" : null, props.className) },
      props.label ? h("label", { className: "as-label", htmlFor: r.current }, props.label) : null,
      h("div", { className: "as-input-wrap" },
        props.icon ? h(Icon, { name: props.icon, size: 18 }) : null,
        h("input", Object.assign(rest(props, ["label", "icon", "hint", "error", "className", "id"]), { id: r.current, className: "as-input", "aria-invalid": props.error ? true : undefined }))),
      props.error ? h("span", { className: "as-msg as-msg-err" }, props.error) : props.hint ? h("span", { className: "as-msg" }, props.hint) : null);
  }

  function Slider(props) {
    var min = props.min == null ? 0 : props.min, max = props.max == null ? 100 : props.max;
    var st = React.useState(props.defaultValue == null ? min : props.defaultValue);
    var v = props.value == null ? st[0] : props.value;
    var fmt = props.format || function (x) { return String(x); };
    var r = React.useRef(null); if (!r.current) r.current = props.id || "as-s-" + (++fid);
    return h("div", { className: cx("as-slider", "as-t-" + (props.tone || "star"), props.className) },
      h("div", { className: "as-slider-head" },
        props.label ? h("label", { className: "as-label", htmlFor: r.current }, props.label) : h("span"),
        h("output", { className: "as-slider-val", htmlFor: r.current }, fmt(v))),
      h("input", Object.assign(rest(props, ["label", "className", "value", "defaultValue", "onChange", "format", "tone", "id"]), {
        id: r.current, type: "range", min: min, max: max, value: v, className: "as-range", "aria-valuetext": fmt(v),
        style: { "--as-fill": ((v - min) / (max - min) * 100) + "%" },
        onChange: function (e) { st[1](Number(e.target.value)); if (props.onChange) props.onChange(e); }
      })),
      h("div", { className: "as-slider-scale", "aria-hidden": true }, h("span", null, fmt(min)), h("span", null, fmt(max))));
  }

  window.Astrolabe = Object.assign(window.Astrolabe || {}, {
    Panel: Panel, Button: Button, OrbitButton: OrbitButton, MoonToggle: MoonToggle, Constellation: Constellation, Tabs: Tabs,
    SpectralTag: SpectralTag, Readout: Readout, TextField: TextField, Slider: Slider, Icon: Icon, iconNames: Object.keys(ICONS)
  });
})();
