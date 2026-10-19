/* @ds-bundle: {"format":4,"namespace":"Gildmoor","components":[{"name":"Frame"},{"name":"Ribbon"},{"name":"Button"},{"name":"Medallion"},{"name":"ItemCard"},{"name":"RarityTag"},{"name":"Tabs"},{"name":"TextField"},{"name":"Checkbox"},{"name":"ProgressBar"},{"name":"Divider"},{"name":"Icon"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var ICONS = {"sword": [["M20.5 3.5l-1 4.8L9.8 18 6 14.2l9.7-9.7zM4.6 12.6l6.8 6.8M7.7 16.3L3.6 20.4", "stroke"]], "shield": [["M12 3l7.5 3v5.5c0 4.8-3.3 8.2-7.5 9.5-4.2-1.3-7.5-4.7-7.5-9.5V6zM12 7.5v9M8.5 11h7", "stroke"]], "potion": [["M9.5 3h5M10.5 3v5.2L6.2 15A3.6 3.6 0 0 0 9.3 20.5h5.4a3.6 3.6 0 0 0 3.1-5.5L13.5 8.2V3M7.6 14h8.8", "stroke"], ["M9.6 17a0.9 0.9 0 1 0 1.8 0a0.9 0.9 0 1 0 -1.8 0M13.2 16.2a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0", "fill"]], "crown": [["M4.5 17.5L3 8l5 4 4-7 4 7 5-4-1.5 9.5zM4.5 20.5h15", "stroke"], ["M10.9 4.6a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0M2 7.6a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M20 7.6a1 1 0 1 0 2 0a1 1 0 1 0 -2 0", "fill"]], "helm": [["M5 20.5v-8.2a7 7 0 0 1 14 0v8.2h-4.6v-5.3H9.6v5.3zM12 5.3v6.6M9 11.9h6", "stroke"]], "scroll": [["M6.5 6A2.5 2.5 0 0 1 9 3.5h9.5a2.5 2.5 0 0 1 0 5H17V18a2.5 2.5 0 0 1-2.5 2.5H5.5a2.5 2.5 0 0 1 0-5H14M10 9h4M10 12h4", "stroke"]], "book": [["M3.5 5.5C6.2 4 9.3 4 12 5.8 14.7 4 17.8 4 20.5 5.5v13.7c-2.7-1.4-5.8-1.4-8.5.3-2.7-1.7-5.8-1.7-8.5-.3zM12 5.8v13.7", "stroke"]], "gem": [["M7 4h10l4 5-9 11.5L3 9zM3 9h18M9.6 4L8 9l4 11.5L16 9l-1.6-5", "stroke"]], "key": [["M3.5 12a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0M10.5 12h10M17.5 12v3.5M20.5 12v2.5", "stroke"]], "coin": [["M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0 -17 0M6.5 12a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0 -11 0M12 9v6M10.5 10.5h3", "stroke"]], "heart": [["M12 20s-8-4.8-8-10.5A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.5C20 15.2 12 20 12 20z", "stroke"]], "star": [["M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2L12 21.5l-2.2-7.3L2.5 12l7.3-2.2z", "stroke"]], "moon": [["M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z", "stroke"], ["M17.5 4.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L15.5 6.5 17 6z", "fill"]], "sun": [["M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1", "stroke"]], "map": [["M3.5 6.5L9 4.5l6 2 5.5-2v13l-5.5 2-6-2-5.5 2zM9 4.5v13M15 6.5v13", "stroke"]], "chest": [["M3.5 10.5a4.5 4.5 0 0 1 4.5-4.5h8a4.5 4.5 0 0 1 4.5 4.5v9h-17zM3.5 12.5h17M10.5 11h3v3.5h-3z", "stroke"]], "quill": [["M20 3.5c-7 .5-12.3 6-14 13.5l1 .6C10.2 15 14 13 16.2 9.5c-1.9.4-3.4.4-4 0 2.6-.6 5.5-2 7.8-6zM4 20.5l3-3.4", "stroke"]], "flame": [["M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-4.3 4.2-6.2 4.5-10.8 3.5 2 6.5 5.6 6.5 9.6 1-.7 1.6-2 1.8-3 1.3 1.7 1.2 3.4 1.2 4.4C19.5 18.4 16 21 12 21z", "stroke"]], "eye": [["M2.5 12C5 7.5 8.3 5.5 12 5.5s7 2 9.5 6.5c-2.5 4.5-5.8 6.5-9.5 6.5S5 16.5 2.5 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0", "stroke"], ["M10.8 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0", "fill"]], "lock": [["M6 11h12v9.5H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 14.5v2.5", "stroke"]], "settings": [["M12 2.5l1.8 3.2 3.5-1 .2 3.6 3.3 1.5-2 3 2 3-3.3 1.5-.2 3.6-3.5-1L12 21.5l-1.8-3.2-3.5 1-.2-3.6-3.3-1.5 2-3-2-3 3.3-1.5.2-3.6 3.5 1zM9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0", "stroke"]], "menu": [["M4 7h16M4 12h16M4 17h16", "stroke"]], "close": [["M6 6l12 12M18 6L6 18", "stroke"]], "check": [["M5 12.5l4.5 4.5L19 7.5", "stroke"]], "plus": [["M12 5v14M5 12h14", "stroke"]], "arrow-right": [["M4 12h15M14 7l5 5-5 5", "stroke"]], "arrow-left": [["M20 12H5M10 7l-5 5 5 5", "stroke"]], "chevron-right": [["M9 6l6 6-6 6", "stroke"]]};

  function cx() { var o = []; for (var i = 0; i < arguments.length; i++) if (arguments[i]) o.push(arguments[i]); return o.join(" "); }
  function rest(p, omit) { var o = {}; for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k) && omit.indexOf(k) < 0) o[k] = p[k]; return o; }

  function Icon(props) {
    var size = props.size || 20;
    return h("svg", { className: cx("gm-icon", props.className), viewBox: "0 0 24 24", width: size, height: size,
      role: props.label ? "img" : undefined, "aria-label": props.label || undefined, "aria-hidden": props.label ? undefined : true },
      (ICONS[props.name] || []).map(function (p, i) {
        return p[1] === "stroke"
          ? h("path", { key: i, d: p[0], fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" })
          : h("path", { key: i, d: p[0], fill: "currentColor" });
      }));
  }

  function Ribbon(props) {
    return h(props.as || "div", { className: cx("gm-ribbon", "gm-gem-" + (props.gem || "none"), props.className) },
      h("span", { className: "gm-ribbon-text" }, props.children));
  }

  function Frame(props) {
    var shape = props.shape || "panel";
    var attrs = Object.assign({}, rest(props, ["title", "shape", "gem", "footer", "className", "children"]), {
      className: cx("gm-frame", "gm-frame-" + shape, props.gem ? "gm-gem-" + props.gem : null, props.className),
      "aria-label": props.title
    });
    return h("section", attrs,
      h("span", { className: "gm-finial", "aria-hidden": true }),
      h("span", { className: "gm-corner gm-c-tl", "aria-hidden": true }), h("span", { className: "gm-corner gm-c-tr", "aria-hidden": true }),
      h("span", { className: "gm-corner gm-c-bl", "aria-hidden": true }), h("span", { className: "gm-corner gm-c-br", "aria-hidden": true }),
      props.title ? h("header", { className: "gm-frame-head" }, h("h3", { className: "gm-frame-title" }, props.title)) : null,
      h("div", { className: "gm-frame-body" }, props.children),
      props.footer ? h("footer", { className: "gm-frame-foot" }, props.footer) : null);
  }

  function Button(props) {
    var gem = props.gem || "sapphire", size = props.size || "md";
    var attrs = Object.assign({ type: "button" }, rest(props, ["gem", "size", "icon", "className", "children"]), {
      className: cx("gm-btn", "gm-gem-" + gem, "gm-btn-" + size, props.className)
    });
    return h("button", attrs,
      h("span", { className: "gm-btn-cap gm-btn-cap-l", "aria-hidden": true }),
      props.icon ? h(Icon, { name: props.icon, size: size === "lg" ? 22 : 18 }) : null,
      h("span", { className: "gm-btn-label" }, props.children),
      h("span", { className: "gm-btn-cap gm-btn-cap-r", "aria-hidden": true }));
  }

  function Medallion(props) {
    var size = props.size || "md";
    var px = { sm: 18, md: 24, lg: 34, xl: 48 }[size] || 24;
    var attrs = Object.assign({ type: "button" }, rest(props, ["icon", "label", "gem", "size", "className", "children"]), {
      className: cx("gm-medal", "gm-gem-" + (props.gem || "midnight"), "gm-medal-" + size, props.className), "aria-label": props.label
    });
    return h("button", attrs,
      h("span", { className: "gm-stud gm-s-n", "aria-hidden": true }), h("span", { className: "gm-stud gm-s-e", "aria-hidden": true }),
      h("span", { className: "gm-stud gm-s-s", "aria-hidden": true }), h("span", { className: "gm-stud gm-s-w", "aria-hidden": true }),
      props.children || h(Icon, { name: props.icon, size: px }));
  }

  var RARITY = { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" };
  function RarityTag(props) {
    var r = props.rarity || "common";
    return h("span", { className: cx("gm-rarity", "gm-rarity-" + r, props.className) },
      h("span", { className: "gm-rarity-gem", "aria-hidden": true }), props.children || RARITY[r]);
  }

  function ItemCard(props) {
    var attrs = Object.assign({}, rest(props, ["title", "icon", "image", "gem", "rarity", "children", "className", "footer"]), {
      className: cx("gm-card", "gm-gem-" + (props.gem || "sapphire"), props.className)
    });
    return h("article", attrs,
      h("span", { className: "gm-finial", "aria-hidden": true }),
      h(Ribbon, { as: "h3" }, props.title),
      h("div", { className: "gm-card-art" },
        props.image ? h("img", { src: props.image, alt: "" }) : h(Icon, { name: props.icon || "gem", size: 64 })),
      props.rarity ? h("div", { className: "gm-card-meta" }, h(RarityTag, { rarity: props.rarity })) : null,
      props.children ? h("div", { className: "gm-card-text" }, props.children) : null,
      props.footer ? h("div", { className: "gm-card-foot" }, props.footer) : null);
  }

  function Tabs(props) {
    var tabs = props.tabs || [];
    var st = React.useState(props.defaultValue || 0);
    var cur = props.value == null ? st[0] : props.value;
    function pick(i) { st[1](i); if (props.onChange) props.onChange(i); }
    function key(e, i) {
      var n = tabs.length, j = null;
      if (e.key === "ArrowRight") j = (i + 1) % n; else if (e.key === "ArrowLeft") j = (i - 1 + n) % n; else if (e.key === "Home") j = 0; else if (e.key === "End") j = n - 1;
      if (j != null) { e.preventDefault(); pick(j); var el = document.getElementById(props.id + "-t" + j); if (el) el.focus(); }
    }
    var id = props.id || "gm-tabs";
    return h("div", { className: cx("gm-tabs", props.className) },
      h("div", { className: "gm-tablist", role: "tablist", "aria-label": props.label },
        tabs.map(function (t, i) {
          return h("button", { key: i, id: id + "-t" + i, role: "tab", type: "button", "aria-selected": cur === i, tabIndex: cur === i ? 0 : -1,
            className: cx("gm-tab", cur === i ? "gm-tab-on" : null), onClick: function () { pick(i); }, onKeyDown: function (e) { key(e, i); } }, t);
        })),
      props.children ? h("div", { className: "gm-tabpanel", role: "tabpanel", "aria-labelledby": id + "-t" + cur }, typeof props.children === "function" ? props.children(cur) : props.children) : null);
  }

  var fid = 0;
  function TextField(props) {
    var r = React.useRef(null); if (!r.current) r.current = props.id || "gm-f-" + (++fid);
    return h("div", { className: cx("gm-field", props.error ? "gm-field-err" : null, props.className) },
      props.label ? h("label", { className: "gm-label", htmlFor: r.current }, props.label) : null,
      h("div", { className: "gm-input-wrap" },
        props.icon ? h(Icon, { name: props.icon, size: 18 }) : null,
        h("input", Object.assign(rest(props, ["label", "icon", "hint", "error", "className", "id"]), { id: r.current, className: "gm-input", "aria-invalid": props.error ? true : undefined }))),
      props.error ? h("span", { className: "gm-msg gm-msg-err" }, props.error) : props.hint ? h("span", { className: "gm-msg" }, props.hint) : null);
  }

  function Checkbox(props) {
    return h("label", { className: cx("gm-check", props.disabled ? "gm-disabled" : null, props.className) },
      h("input", Object.assign({ type: "checkbox" }, rest(props, ["label", "className", "children"]), { className: "gm-check-input" })),
      h("span", { className: "gm-check-box", "aria-hidden": true }, h("span", { className: "gm-check-mark" })),
      h("span", null, props.label || props.children));
  }

  function ProgressBar(props) {
    var v = Math.max(0, Math.min(100, props.value || 0));
    return h("div", { className: cx("gm-progress", "gm-gem-" + (props.gem || "gold"), props.className) },
      props.label ? h("div", { className: "gm-progress-head" }, h("span", { className: "gm-label" }, props.label), h("span", { className: "gm-progress-val" }, props.display || Math.round(v) + "%")) : null,
      h("div", { className: "gm-progress-track", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(v), "aria-label": props.label },
        h("span", { className: "gm-progress-fill", style: { width: v + "%" } })));
  }

  function Divider(props) {
    return h("div", { className: cx("gm-divider", "gm-divider-" + (props.variant || "diamond"), props.className), role: "separator" },
      props.label ? h("span", { className: "gm-divider-label" }, props.label) : h("span", { className: "gm-divider-orn", "aria-hidden": true }));
  }

  window.Gildmoor = Object.assign(window.Gildmoor || {}, {
    Frame: Frame, Ribbon: Ribbon, Button: Button, Medallion: Medallion, ItemCard: ItemCard, RarityTag: RarityTag,
    Tabs: Tabs, TextField: TextField, Checkbox: Checkbox, ProgressBar: ProgressBar, Divider: Divider, Icon: Icon,
    iconNames: Object.keys(ICONS)
  });
})();
