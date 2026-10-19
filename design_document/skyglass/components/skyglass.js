/* @ds-bundle: {"format":4,"namespace":"Skyglass","components":[{"name":"Window"},{"name":"GlassPanel"},{"name":"Button"},{"name":"OrbButton"},{"name":"TextField"},{"name":"Slider"},{"name":"MediaBar"},{"name":"TrackList"},{"name":"AppTile"},{"name":"Chip"},{"name":"Icon"},{"name":"IconBadge"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var ICONS = {"arrow-left": [["M14.5 5.5L8 12l6.5 6.5", "stroke"]], "arrow-right": [["M9.5 5.5L16 12l-6.5 6.5", "stroke"]], "close": [["M6.5 6.5l11 11M17.5 6.5l-11 11", "stroke"]], "minimize": [["M6 16.5h12", "stroke"]], "maximize": [["M7.5 6h9a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 16.5v-9A1.5 1.5 0 0 1 7.5 6z", "stroke"]], "check": [["M5.5 12.5l4.2 4.2 8.8-9.2", "stroke"]], "plus": [["M12 5.5v13M5.5 12h13", "stroke"]], "play": [["M8 5.4c0-1 1.1-1.6 1.9-1l9.3 6.4c.7.5.7 1.5 0 2l-9.3 6.4c-.8.6-1.9 0-1.9-1z", "fill"]], "pause": [["M7 5.5a1.5 1.5 0 0 1 3 0v13a1.5 1.5 0 0 1-3 0zM14 5.5a1.5 1.5 0 0 1 3 0v13a1.5 1.5 0 0 1-3 0z", "fill"]], "next": [["M4.5 6.6c0-.8.9-1.3 1.6-.8l7.6 5.4c.6.4.6 1.3 0 1.7l-7.6 5.3c-.7.5-1.6 0-1.6-.8zM16 5.5a1.5 1.5 0 0 1 3 0v13a1.5 1.5 0 0 1-3 0z", "fill"]], "prev": [["M19.5 6.6c0-.8-.9-1.3-1.6-.8l-7.6 5.4c-.6.4-.6 1.3 0 1.7l7.6 5.3c.7.5 1.6 0 1.6-.8zM4.5 5.5a1.5 1.5 0 0 1 3 0v13a1.5 1.5 0 0 1-3 0z", "fill"]], "shuffle": [["M4 7.5h2.5c4.5 0 6.5 9 11 9H20M4 16.5h2.5c1.7 0 2.9-1.3 4-3M13.5 10.5c1.1-1.7 2.3-3 4-3H20M17.5 5L20 7.5 17.5 10M17.5 14L20 16.5 17.5 19", "stroke"]], "repeat": [["M4.5 11.5V10a3.5 3.5 0 0 1 3.5-3.5h11M16.5 4L19 6.5 16.5 9M19.5 12.5V14a3.5 3.5 0 0 1-3.5 3.5H5M7.5 20L5 17.5 7.5 15", "stroke"]], "search": [["M4.5 10.5a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M15.2 15.2l4.3 4.3", "stroke"]], "home": [["M11.2 3.9a1.2 1.2 0 0 1 1.6 0l7.6 6.7c.6.5.2 1.4-.5 1.4H18.5v7a1 1 0 0 1-1 1H14.2v-5.2H9.8V20H6.5a1 1 0 0 1-1-1v-7H4.1c-.7 0-1.1-.9-.5-1.4z", "fill"]], "heart": [["M12 20.6s-8.2-4.9-8.2-10.8A4.5 4.5 0 0 1 12 7.1a4.5 4.5 0 0 1 8.2 2.7c0 5.9-8.2 10.8-8.2 10.8z", "fill"]], "mail": [["M4.5 5h15a2.2 2.2 0 0 1 2.2 2.2v9.6a2.2 2.2 0 0 1-2.2 2.2h-15a2.2 2.2 0 0 1-2.2-2.2V7.2A2.2 2.2 0 0 1 4.5 5zM3.6 7.4l8.4 5.8 8.4-5.8v2.1L12 15.3 3.6 9.5z", "even"]], "user": [["M7.8 7.8a4.2 4.2 0 1 0 8.4 0a4.2 4.2 0 1 0 -8.4 0M3.8 20.2c.4-4.1 3.9-6.7 8.2-6.7s7.8 2.6 8.2 6.7c0 .5-.4.8-.9.8H4.7c-.5 0-.9-.3-.9-.8z", "fill"]], "music": [["M9.3 17.3V6.6c0-.5.3-.9.8-1l8.3-1.9c.6-.1 1.1.3 1.1.9v10.4", "stroke"], ["M3.7 17.4a2.9 2.9 0 1 0 5.8 0a2.9 2.9 0 1 0 -5.8 0M13.7 15.4a2.9 2.9 0 1 0 5.8 0a2.9 2.9 0 1 0 -5.8 0", "fill"]], "settings": [["M20.98 12.54L20.51 14.94L17.94 14.89L16.94 16.38L17.97 18.73L15.94 20.09L14.16 18.24L12.40 18.59L11.46 20.98L9.06 20.51L9.11 17.94L7.62 16.94L5.27 17.97L3.91 15.94L5.76 14.16L5.41 12.40L3.02 11.46L3.49 9.06L6.06 9.11L7.06 7.62L6.03 5.27L8.06 3.91L9.84 5.76L11.60 5.41L12.54 3.02L14.94 3.49L14.89 6.06L16.38 7.06L18.73 6.03L20.09 8.06L18.24 9.84L18.59 11.60zM9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0", "even"]], "sun": [["M7.4 12a4.6 4.6 0 1 0 9.2 0a4.6 4.6 0 1 0 -9.2 0", "fill"], ["M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M5.4 18.6l1.4-1.4M17.2 6.8l1.4-1.4", "stroke"]], "download": [["M12 4.5v10M7.5 10.5L12 15l4.5-4.5M5.5 19.5h13", "stroke"]], "volume": [["M3.8 9.8c0-.6.4-1 1-1h2.7l4.1-3.6c.6-.5 1.6-.1 1.6.8v12c0 .9-1 1.3-1.6.8l-4.1-3.6H4.8c-.6 0-1-.4-1-1z", "fill"], ["M16.2 9.2a4 4 0 0 1 0 5.6M18.8 6.8a7.6 7.6 0 0 1 0 10.4", "stroke"]], "more": [["M3.5 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M10 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M16.5 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0", "fill"]], "image": [["M5.5 4.5h13a2.5 2.5 0 0 1 2.5 2.5v10a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17V7a2.5 2.5 0 0 1 2.5-2.5zM5 17.5h14l-4.6-5.6-3.2 3.8-2-2.2zM13.7 8.8a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0", "even"]]};

  function cx() {
    var o = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) o.push(arguments[i]);
    return o.join(" ");
  }
  function rest(p, omit) {
    var o = {};
    for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k) && omit.indexOf(k) < 0) o[k] = p[k];
    return o;
  }

  function Icon(props) {
    var size = props.size || 20;
    var parts = ICONS[props.name] || [];
    return h("svg", {
      className: cx("sg-icon", props.className), viewBox: "0 0 24 24", width: size, height: size,
      role: props.label ? "img" : undefined, "aria-label": props.label || undefined, "aria-hidden": props.label ? undefined : true
    }, parts.map(function (p, i) {
      if (p[1] === "stroke") return h("path", { key: i, d: p[0], fill: "none", stroke: "currentColor", strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round" });
      return h("path", { key: i, d: p[0], fill: "currentColor", fillRule: p[1] === "even" ? "evenodd" : undefined });
    }));
  }

  function IconBadge(props) {
    var size = props.size || "md";
    return h("span", { className: cx("sg-badge", "sg-tone-" + (props.tone || "aqua"), "sg-badge-" + size, props.className),
      role: props.label ? "img" : undefined, "aria-label": props.label || undefined, "aria-hidden": props.label ? undefined : true },
      h(Icon, { name: props.name, size: { sm: 16, md: 20, lg: 30 }[size] || 20 }));
  }

  function Button(props) {
    var tone = props.tone || "blue", size = props.size || "md";
    return h("button", Object.assign({ type: "button" }, rest(props, ["tone", "size", "icon", "className", "children"]), {
      className: cx("sg-btn", "sg-tone-" + tone, "sg-btn-" + size, props.className)
    }), props.icon ? h(Icon, { name: props.icon, size: size === "lg" ? 22 : 18 }) : null,
      props.children != null ? h("span", null, props.children) : null);
  }

  function OrbButton(props) {
    var tone = props.tone || "glass", size = props.size || "md";
    var px = { sm: 18, md: 22, lg: 30, xl: 40 }[size] || 22;
    return h("button", Object.assign({ type: "button" }, rest(props, ["tone", "size", "icon", "className", "label"]), {
      className: cx("sg-orb", "sg-tone-" + tone, "sg-orb-" + size, props.className), "aria-label": props.label
    }), h(Icon, { name: props.icon, size: px }));
  }

  function Window(props) {
    return h("section", Object.assign(rest(props, ["title", "icon", "controls", "onControl", "className", "children", "footer"]), {
      className: cx("sg-window", props.className), "aria-label": props.title
    }),
      h("header", { className: "sg-window-bar" },
        props.icon ? h(Icon, { name: props.icon, size: 16 }) : null,
        h("span", { className: "sg-window-title" }, props.title),
        h("span", { className: "sg-window-ctl" }, (props.controls || ["minimize", "maximize", "close"]).map(function (c) {
          return h("button", { key: c, type: "button", className: cx("sg-ctl", "sg-ctl-" + c), "aria-label": c,
            onClick: props.onControl ? function () { props.onControl(c); } : undefined }, h(Icon, { name: c, size: 12 }));
        }))),
      h("div", { className: "sg-window-body" }, props.children),
      props.footer ? h("footer", { className: "sg-window-foot" }, props.footer) : null);
  }

  function GlassPanel(props) {
    return h("div", Object.assign(rest(props, ["title", "action", "strong", "className", "children"]), {
      className: cx("sg-panel", props.strong ? "sg-panel-strong" : null, props.className)
    }),
      props.title || props.action ? h("div", { className: "sg-panel-head" },
        props.title ? h("h3", { className: "sg-panel-title" }, props.title) : null,
        props.action ? h("span", { className: "sg-panel-action" }, props.action) : null) : null,
      props.children);
  }

  var fid = 0;
  function TextField(props) {
    var r = React.useRef(null);
    if (!r.current) r.current = props.id || "sg-field-" + (++fid);
    return h("div", { className: cx("sg-field", props.className) },
      props.label ? h("label", { className: "sg-field-label", htmlFor: r.current }, props.label) : null,
      h("div", { className: cx("sg-input-wrap", props.error ? "sg-input-error" : null) },
        props.icon ? h(Icon, { name: props.icon, size: 18 }) : null,
        h("input", Object.assign(rest(props, ["label", "icon", "hint", "error", "className", "id"]), { id: r.current, className: "sg-input", "aria-invalid": props.error ? true : undefined }))),
      props.error ? h("span", { className: "sg-field-msg sg-field-msg-error" }, props.error)
        : props.hint ? h("span", { className: "sg-field-msg" }, props.hint) : null);
  }

  function Slider(props) {
    var min = props.min == null ? 0 : props.min, max = props.max == null ? 100 : props.max;
    var st = React.useState(props.defaultValue == null ? min : props.defaultValue);
    var v = props.value == null ? st[0] : props.value;
    return h("label", { className: cx("sg-slider", props.className) },
      props.label ? h("span", { className: "sg-field-label" }, props.label) : null,
      h("input", Object.assign(rest(props, ["label", "className", "value", "defaultValue", "onChange"]), {
        type: "range", min: min, max: max, value: v, className: "sg-range",
        style: { "--sg-fill": ((v - min) / (max - min) * 100) + "%" },
        onChange: function (e) { st[1](Number(e.target.value)); if (props.onChange) props.onChange(e); }
      })));
  }

  function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
  function MediaBar(props) {
    var dur = props.duration || 240;
    var ps = React.useState(!!props.playing), playing = ps[0];
    var ts = React.useState(props.position || 0), pos = ts[0];
    return h("div", { className: cx("sg-media", props.className) }, h("div", { className: "sg-media-inner" },
      h("div", { className: "sg-media-now" },
        props.cover ? h("img", { className: "sg-media-cover", src: props.cover, alt: "" }) : h("span", { className: "sg-media-cover sg-media-cover-empty" }, h(Icon, { name: "music", size: 20 })),
        h("span", { className: "sg-media-text" }, h("strong", null, props.title || "Nothing playing"), props.artist ? h("span", null, props.artist) : null)),
      h("div", { className: "sg-media-center" },
        h("div", { className: "sg-media-ctl" },
          h(OrbButton, { icon: "shuffle", size: "sm", label: "Shuffle", className: "sg-media-aux" }),
          h(OrbButton, { icon: "prev", label: "Previous" }),
          h(OrbButton, { icon: playing ? "pause" : "play", size: "lg", tone: "blue", label: playing ? "Pause" : "Play",
            onClick: function () { ps[1](!playing); if (props.onPlayToggle) props.onPlayToggle(!playing); } }),
          h(OrbButton, { icon: "next", label: "Next" }),
          h(OrbButton, { icon: "repeat", size: "sm", label: "Repeat", className: "sg-media-aux" })),
        h("div", { className: "sg-media-seek" },
          h("span", { className: "sg-media-time" }, fmt(pos)),
          h("input", { type: "range", min: 0, max: dur, value: pos, className: "sg-range", "aria-label": "Seek",
            style: { "--sg-fill": (pos / dur * 100) + "%" }, onChange: function (e) { ts[1](Number(e.target.value)); } }),
          h("span", { className: "sg-media-time" }, fmt(dur)))),
      h("div", { className: "sg-media-vol" }, h(Icon, { name: "volume", size: 18 }),
        h(Slider, { defaultValue: 70, "aria-label": "Volume" }))));
  }

  function TrackList(props) {
    var rows = props.tracks || [];
    return h("div", { className: cx("sg-tracks", props.className), role: "table" },
      h("div", { className: "sg-track sg-track-head", role: "row" },
        h("span", { role: "columnheader" }, "#"), h("span", { role: "columnheader" }, "Title"), h("span", { role: "columnheader", className: "sg-num" }, props.metaLabel || "Plays")),
      rows.map(function (t, i) {
        var active = props.activeIndex === i;
        return h("div", { key: i, role: "row", className: cx("sg-track", active ? "sg-track-active" : null),
          "aria-selected": active || undefined,
          onClick: props.onSelect ? function () { props.onSelect(i); } : undefined, tabIndex: props.onSelect ? 0 : undefined,
          onKeyDown: props.onSelect ? function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); props.onSelect(i); } } : undefined },
          h("span", { role: "cell", className: "sg-track-idx" }, active ? h(Icon, { name: "volume", size: 16 }) : i + 1),
          h("span", { role: "cell", className: "sg-track-main" }, h("strong", null, t.title), t.artist ? h("span", null, t.artist) : null),
          h("span", { role: "cell", className: "sg-num" }, t.meta));
      }));
  }

  function AppTile(props) {
    return h("button", Object.assign({ type: "button" }, rest(props, ["icon", "label", "tone", "size", "className"]), {
      className: cx("sg-tile", "sg-tone-" + (props.tone || "aqua"), props.size === "lg" ? "sg-tile-lg" : null, props.className)
    }), h("span", { className: "sg-tile-face" }, h(Icon, { name: props.icon, size: props.size === "lg" ? 56 : 34 })),
      props.label ? h("span", { className: "sg-tile-label" }, props.label) : null);
  }

  function Chip(props) {
    return h(props.onClick ? "button" : "span", Object.assign(props.onClick ? { type: "button" } : {}, rest(props, ["icon", "tone", "selected", "className", "children"]), {
      className: cx("sg-chip", props.selected ? "sg-chip-on" : null, props.tone ? "sg-chip-" + props.tone : null, props.className),
      "aria-pressed": props.onClick ? !!props.selected : undefined
    }), props.icon ? h(Icon, { name: props.icon, size: 14 }) : null, props.children);
  }

  window.Skyglass = Object.assign(window.Skyglass || {}, {
    Window: Window, GlassPanel: GlassPanel, Button: Button, OrbButton: OrbButton, TextField: TextField,
    Slider: Slider, MediaBar: MediaBar, TrackList: TrackList, AppTile: AppTile, Chip: Chip, Icon: Icon, IconBadge: IconBadge,
    iconNames: Object.keys(ICONS)
  });
})();
