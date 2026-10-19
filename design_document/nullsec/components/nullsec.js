/* @ds-bundle: {"format":4,"namespace":"Nullsec","components":[{"name":"Frame"},{"name":"Button"},{"name":"IconButton"},{"name":"TextField"},{"name":"Checkbox"},{"name":"Meter"},{"name":"Readout"},{"name":"StatusTag"},{"name":"MenuList"},{"name":"Target"},{"name":"Divider"},{"name":"Icon"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var ICONS = {"close": [["M5 5l14 14M19 5L5 19", "stroke"]], "check": [["M4 12.5l5 5L20 6.5", "stroke"]], "plus": [["M12 4v16M4 12h16", "stroke"]], "minus": [["M4 12h16", "stroke"]], "arrow-right": [["M3.5 12h15M13 6l6 6-6 6", "stroke"]], "arrow-left": [["M20.5 12h-15M11 6l-6 6 6 6", "stroke"]], "chevron-right": [["M9 5l7 7-7 7", "stroke"]], "chevrons-right": [["M5 5l7 7-7 7M12 5l7 7-7 7", "stroke"]], "chevron-down": [["M5 9l7 7 7-7", "stroke"]], "menu": [["M4 6h16M4 12h16M4 18h10", "stroke"]], "warning": [["M12 3L22 20.5H2z", "stroke"], ["M11 9h2v6h-2zM11 16.5h2v2h-2z", "fill"]], "lock": [["M5.5 11h13v9.5h-13zM8.5 11V7l2-2h3l2 2v4", "stroke"], ["M11 14.5h2v3h-2z", "fill"]], "unlock": [["M5.5 11h13v9.5h-13zM8.5 11V7l2-2h3l2 2", "stroke"], ["M11 14.5h2v3h-2z", "fill"]], "search": [["M10 3.5l5.6 3.2v6.6L10 16.5l-5.6-3.2V6.7zM15 15l5.5 5.5", "stroke"]], "settings": [["M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5zM9.5 9.5h5v5h-5z", "stroke"]], "user": [["M9 3.5h6l1.5 1.5v4.5L15 11H9L7.5 9.5V5zM4 21v-3l3-3h10l3 3v3", "stroke"]], "power": [["M12 3v8M7.5 6L5 9v7l3 3h8l3-3V9l-2.5-3", "stroke"]], "signal": [["M4 20v-3M9 20v-7M14 20V9M19 20V4", "stroke"]], "target": [["M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M12 8.5v7M8.5 12h7", "stroke"]], "globe": [["M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0 -17 0M12 3.5c-4.2 4.8-4.2 12.2 0 17M12 3.5c4.2 4.8 4.2 12.2 0 17M3.5 12h17M5 7.5h14M5 16.5h14", "stroke"]], "cube": [["M12 2.5l8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5zM3.5 7.25L12 12l8.5-4.75M12 12v9.5", "stroke"]], "chip": [["M7 7h10v10H7zM10 10h4v4h-4zM9.5 3v4M14.5 3v4M9.5 17v4M14.5 17v4M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4", "stroke"]], "battery": [["M2.5 7h16v10h-16zM18.5 10h2.5v4h-2.5", "stroke"], ["M5 9.5h3v5H5zM9.5 9.5h3v5h-3z", "fill"]], "mail": [["M3 5.5h18v13H3zM3 6l9 7 9-7", "stroke"]], "heart": [["M12 20L3.5 11.5V7l3-3h3L12 6.5 14.5 4h3l3 3v4.5z", "stroke"]], "eye": [["M2 12l5-5h10l5 5-5 5H7z", "stroke"], ["M10 10h4v4h-4z", "fill"]], "terminal": [["M3 4h18v16H3zM6.5 9l3 3-3 3M12 15h5.5", "stroke"]], "download": [["M12 3v12M6.5 9.5L12 15l5.5-5.5M4 20h16", "stroke"]], "play": [["M7 4l13 8-13 8z", "fill"]], "pause": [["M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z", "fill"]], "stop": [["M5.5 5.5h13v13h-13z", "fill"]]};

  function cx() { var o = []; for (var i = 0; i < arguments.length; i++) if (arguments[i]) o.push(arguments[i]); return o.join(" "); }
  function rest(p, omit) { var o = {}; for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k) && omit.indexOf(k) < 0) o[k] = p[k]; return o; }

  function Icon(props) {
    var size = props.size || 20;
    return h("svg", { className: cx("nx-icon", props.className), viewBox: "0 0 24 24", width: size, height: size,
      role: props.label ? "img" : undefined, "aria-label": props.label || undefined, "aria-hidden": props.label ? undefined : true },
      (ICONS[props.name] || []).map(function (p, i) {
        return p[1] === "stroke"
          ? h("path", { key: i, d: p[0], fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "square", strokeLinejoin: "miter" })
          : h("path", { key: i, d: p[0], fill: "currentColor" });
      }));
  }

  function Frame(props) {
    var tone = props.tone || "red";
    return h("section", Object.assign(rest(props, ["title", "code", "tone", "striped", "variant", "footer", "className", "children"]), {
      className: cx("nx-frame", "nx-t-" + tone, props.variant === "notched" ? "nx-frame-notched" : null, props.className), "aria-label": props.title
    }),
      h("div", { className: "nx-frame-inner" },
        props.title || props.code ? h("header", { className: "nx-frame-head" },
          props.title ? h("span", { className: "nx-frame-tab" }, props.title) : null,
          h("span", { className: "nx-frame-rule", "aria-hidden": true }),
          props.code ? h("span", { className: "nx-frame-code" }, props.code) : null) : null,
        props.striped ? h("div", { className: "nx-stripes", "aria-hidden": true }) : null,
        h("div", { className: "nx-frame-body" }, props.children),
        props.footer ? h("footer", { className: "nx-frame-foot" }, props.footer) : null));
  }

  function Button(props) {
    var v = props.variant || "solid", tone = props.tone || "red", size = props.size || "md";
    return h("button", Object.assign({ type: "button" }, rest(props, ["variant", "tone", "size", "icon", "trailing", "className", "children"]), {
      className: cx("nx-btn", "nx-btn-" + v, "nx-t-" + tone, "nx-btn-" + size, props.className)
    }), props.icon ? h(Icon, { name: props.icon, size: 18 }) : null,
      h("span", { className: "nx-btn-label" }, props.children),
      props.trailing !== false && v !== "ghost" ? h(Icon, { name: props.trailing || "chevron-right", size: 16, className: "nx-btn-trail" }) : null);
  }

  function IconButton(props) {
    return h("button", Object.assign({ type: "button" }, rest(props, ["icon", "label", "tone", "size", "variant", "className"]), {
      className: cx("nx-ibtn", "nx-t-" + (props.tone || "red"), "nx-ibtn-" + (props.size || "md"), props.variant === "solid" ? "nx-ibtn-solid" : null, props.className),
      "aria-label": props.label
    }), h(Icon, { name: props.icon, size: props.size === "lg" ? 28 : props.size === "sm" ? 16 : 20 }));
  }

  var fid = 0;
  function TextField(props) {
    var r = React.useRef(null); if (!r.current) r.current = props.id || "nx-f-" + (++fid);
    return h("div", { className: cx("nx-field", props.error ? "nx-field-err" : null, props.className) },
      props.label ? h("label", { className: "nx-label", htmlFor: r.current }, props.label) : null,
      h("div", { className: "nx-input-wrap" },
        props.icon ? h(Icon, { name: props.icon, size: 18 }) : null,
        h("input", Object.assign(rest(props, ["label", "icon", "hint", "error", "className", "id"]), { id: r.current, className: "nx-input", "aria-invalid": props.error ? true : undefined }))),
      props.error ? h("span", { className: "nx-msg nx-msg-err" }, h(Icon, { name: "warning", size: 14 }), props.error)
        : props.hint ? h("span", { className: "nx-msg" }, props.hint) : null);
  }

  function Checkbox(props) {
    return h("label", { className: cx("nx-check", props.disabled ? "nx-disabled" : null, props.className) },
      h("input", Object.assign({ type: "checkbox" }, rest(props, ["label", "className", "children"]), { className: "nx-check-input" })),
      h("span", { className: "nx-check-box", "aria-hidden": true }, h(Icon, { name: "check", size: 14 })),
      h("span", null, props.label || props.children));
  }

  function Meter(props) {
    var segs = props.segments || 20, v = Math.max(0, Math.min(100, props.value || 0)), on = Math.round(v / 100 * segs), cells = [];
    for (var i = 0; i < segs; i++) cells.push(h("span", { key: i, className: cx("nx-seg", i < on ? "nx-seg-on" : null) }));
    return h("div", { className: cx("nx-meter", "nx-t-" + (props.tone || "red"), props.className) },
      h("div", { className: "nx-meter-head" },
        props.icon ? h(Icon, { name: props.icon, size: 14 }) : null,
        h("span", { className: "nx-label" }, props.label),
        h("span", { className: "nx-meter-val" }, props.display || Math.round(v) + "%")),
      h("div", { className: "nx-meter-track", role: "meter", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(v), "aria-label": props.label }, cells));
  }

  function Readout(props) {
    return h("div", { className: cx("nx-readout", "nx-t-" + (props.tone || "cyan"), props.className) },
      h("span", { className: "nx-label" }, props.label),
      h("span", { className: "nx-readout-val" }, props.value, props.unit ? h("small", null, props.unit) : null),
      props.caption ? h("span", { className: "nx-readout-cap" }, props.caption) : null);
  }

  var TAG_ICON = { locked: "lock", unlocked: "unlock", warning: "warning", online: "signal", offline: "power" };
  function StatusTag(props) {
    var kind = props.kind || "online";
    return h("span", { className: cx("nx-tag", "nx-tag-" + kind, props.className) },
      h(Icon, { name: props.icon || TAG_ICON[kind] || "chip", size: 14 }), props.children || kind);
  }

  function MenuList(props) {
    var items = props.items || [];
    return h("nav", { className: cx("nx-menu", props.className), "aria-label": props.label || "Menu" },
      h("ul", null, items.map(function (it, i) {
        var active = props.active === i;
        return h("li", { key: i },
          h("button", { type: "button", className: cx("nx-menu-item", active ? "nx-menu-on" : null), "aria-current": active ? "true" : undefined,
            disabled: it.disabled, onClick: props.onSelect ? function () { props.onSelect(i); } : undefined },
            h("span", { className: "nx-menu-idx" }, ("00" + (i + 1)).slice(-3)),
            h("span", { className: "nx-menu-label" }, it.label),
            it.disabled ? h(Icon, { name: "lock", size: 16 }) : h(Icon, { name: "chevron-right", size: 16 })));
      })));
  }

  function Target(props) {
    return h("div", { className: cx("nx-target", "nx-t-" + (props.tone || "red"), props.locked ? "nx-target-lock" : null, props.className) },
      h("span", { className: "nx-target-c nx-tl", "aria-hidden": true }), h("span", { className: "nx-target-c nx-tr", "aria-hidden": true }),
      h("span", { className: "nx-target-c nx-bl", "aria-hidden": true }), h("span", { className: "nx-target-c nx-br", "aria-hidden": true }),
      props.label ? h("span", { className: "nx-target-label" }, props.label) : null,
      props.children);
  }

  function Divider(props) {
    return h("div", { className: cx("nx-divider", "nx-divider-" + (props.variant || "ticks"), "nx-t-" + (props.tone || "red"), props.className), role: "separator" },
      props.label ? h("span", { className: "nx-label" }, props.label) : null);
  }

  window.Nullsec = Object.assign(window.Nullsec || {}, {
    Frame: Frame, Button: Button, IconButton: IconButton, TextField: TextField, Checkbox: Checkbox, Meter: Meter,
    Readout: Readout, StatusTag: StatusTag, MenuList: MenuList, Target: Target, Divider: Divider, Icon: Icon,
    iconNames: Object.keys(ICONS)
  });
})();
