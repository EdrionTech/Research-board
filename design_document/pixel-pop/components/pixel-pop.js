/* @ds-bundle: {"format":4,"namespace":"PixelPop","components":[{"name":"Window"},{"name":"Dialog"},{"name":"Button"},{"name":"TextField"},{"name":"Checkbox"},{"name":"ProgressBar"},{"name":"Slider"},{"name":"Badge"},{"name":"SpeechBubble"},{"name":"PixelIcon"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;
  var PATHS = {"close": "M2 2h2v1h-2zM12 2h2v1h-2zM2 3h3v1h-3zM11 3h3v1h-3zM3 4h3v1h-3zM10 4h3v1h-3zM4 5h3v1h-3zM9 5h3v1h-3zM5 6h6v1h-6zM6 7h4v1h-4zM6 8h4v1h-4zM5 9h6v1h-6zM4 10h3v1h-3zM9 10h3v1h-3zM3 11h3v1h-3zM10 11h3v1h-3zM2 12h3v1h-3zM11 12h3v1h-3zM2 13h2v1h-2zM12 13h2v1h-2z", "minimize": "M3 11h10v1h-10zM3 12h10v1h-10z", "maximize": "M2 2h12v1h-12zM2 3h12v1h-12zM2 4h12v1h-12zM2 5h2v1h-2zM12 5h2v1h-2zM2 6h2v1h-2zM12 6h2v1h-2zM2 7h2v1h-2zM12 7h2v1h-2zM2 8h2v1h-2zM12 8h2v1h-2zM2 9h2v1h-2zM12 9h2v1h-2zM2 10h2v1h-2zM12 10h2v1h-2zM2 11h2v1h-2zM12 11h2v1h-2zM2 12h12v1h-12zM2 13h12v1h-12z", "check": "M14 2h2v1h-2zM13 3h3v1h-3zM12 4h3v1h-3zM11 5h3v1h-3zM2 6h2v1h-2zM10 6h3v1h-3zM2 7h3v1h-3zM9 7h3v1h-3zM3 8h3v1h-3zM8 8h3v1h-3zM4 9h6v1h-6zM5 10h4v1h-4zM6 11h2v1h-2z", "info": "M4 1h8v1h-8zM3 2h2v1h-2zM11 2h2v1h-2zM2 3h2v1h-2zM7 3h2v1h-2zM12 3h2v1h-2zM1 4h2v1h-2zM7 4h2v1h-2zM13 4h2v1h-2zM1 5h2v1h-2zM13 5h2v1h-2zM1 6h2v1h-2zM6 6h3v1h-3zM13 6h2v1h-2zM1 7h2v1h-2zM7 7h2v1h-2zM13 7h2v1h-2zM1 8h2v1h-2zM7 8h2v1h-2zM13 8h2v1h-2zM1 9h2v1h-2zM7 9h2v1h-2zM13 9h2v1h-2zM1 10h2v1h-2zM6 10h4v1h-4zM13 10h2v1h-2zM2 11h2v1h-2zM12 11h2v1h-2zM3 12h2v1h-2zM11 12h2v1h-2zM4 13h8v1h-8z", "warning": "M7 0h2v1h-2zM6 1h4v1h-4zM6 2h4v1h-4zM5 3h6v1h-6zM5 4h2v1h-2zM9 4h2v1h-2zM4 5h3v1h-3zM9 5h3v1h-3zM4 6h2v1h-2zM7 6h2v1h-2zM10 6h2v1h-2zM3 7h3v1h-3zM7 7h2v1h-2zM10 7h3v1h-3zM3 8h2v1h-2zM7 8h2v1h-2zM11 8h2v1h-2zM2 9h3v1h-3zM7 9h2v1h-2zM11 9h3v1h-3zM2 10h2v1h-2zM12 10h2v1h-2zM1 11h3v1h-3zM7 11h2v1h-2zM12 11h3v1h-3zM1 12h2v1h-2zM13 12h2v1h-2zM0 13h16v1h-16zM0 14h16v1h-16z", "search": "M3 2h5v1h-5zM2 3h2v1h-2zM7 3h2v1h-2zM1 4h2v1h-2zM8 4h2v1h-2zM1 5h1v1h-1zM9 5h1v1h-1zM1 6h1v1h-1zM9 6h1v1h-1zM1 7h1v1h-1zM9 7h1v1h-1zM1 8h2v1h-2zM8 8h2v1h-2zM2 9h2v1h-2zM7 9h3v1h-3zM3 10h7v1h-7zM9 11h3v1h-3zM10 12h3v1h-3zM11 13h3v1h-3zM12 14h2v1h-2z", "folder": "M1 2h6v1h-6zM1 3h7v1h-7zM1 4h14v1h-14zM1 5h2v1h-2zM13 5h2v1h-2zM1 6h2v1h-2zM13 6h2v1h-2zM1 7h2v1h-2zM13 7h2v1h-2zM1 8h2v1h-2zM13 8h2v1h-2zM1 9h2v1h-2zM13 9h2v1h-2zM1 10h2v1h-2zM13 10h2v1h-2zM1 11h14v1h-14zM1 12h14v1h-14z", "mail": "M1 3h14v1h-14zM1 4h3v1h-3zM12 4h3v1h-3zM1 5h1v1h-1zM3 5h2v1h-2zM11 5h2v1h-2zM14 5h1v1h-1zM1 6h1v1h-1zM4 6h2v1h-2zM10 6h2v1h-2zM14 6h1v1h-1zM1 7h1v1h-1zM5 7h2v1h-2zM9 7h2v1h-2zM14 7h1v1h-1zM1 8h1v1h-1zM6 8h4v1h-4zM14 8h1v1h-1zM1 9h1v1h-1zM7 9h2v1h-2zM14 9h1v1h-1zM1 10h1v1h-1zM14 10h1v1h-1zM1 11h1v1h-1zM14 11h1v1h-1zM1 12h14v1h-14z", "heart": "M3 2h3v1h-3zM10 2h3v1h-3zM2 3h5v1h-5zM9 3h5v1h-5zM1 4h14v1h-14zM1 5h14v1h-14zM1 6h14v1h-14zM2 7h12v1h-12zM3 8h10v1h-10zM4 9h8v1h-8zM5 10h6v1h-6zM6 11h4v1h-4zM7 12h2v1h-2z", "star": "M7 1h2v1h-2zM7 2h2v1h-2zM6 3h4v1h-4zM6 4h4v1h-4zM1 5h14v1h-14zM2 6h12v1h-12zM3 7h10v1h-10zM4 8h8v1h-8zM4 9h8v1h-8zM3 10h4v1h-4zM9 10h4v1h-4zM3 11h3v1h-3zM10 11h3v1h-3zM2 12h3v1h-3zM11 12h3v1h-3zM2 13h2v1h-2zM12 13h2v1h-2z", "sparkle": "M7 1h2v1h-2zM7 2h2v1h-2zM7 3h2v1h-2zM6 4h4v1h-4zM6 5h4v1h-4zM5 6h6v1h-6zM1 7h14v1h-14zM1 8h14v1h-14zM5 9h6v1h-6zM6 10h4v1h-4zM6 11h4v1h-4zM7 12h2v1h-2zM7 13h2v1h-2zM7 14h2v1h-2z", "play": "M3 2h2v1h-2zM3 3h4v1h-4zM3 4h6v1h-6zM3 5h8v1h-8zM3 6h10v1h-10zM3 7h11v1h-11zM3 8h11v1h-11zM3 9h10v1h-10zM3 10h8v1h-8zM3 11h6v1h-6zM3 12h4v1h-4zM3 13h2v1h-2z", "arrow-left": "M7 2h1v1h-1zM6 3h2v1h-2zM5 4h3v1h-3zM4 5h4v1h-4zM4 6h10v1h-10zM3 7h11v1h-11zM3 8h11v1h-11zM4 9h10v1h-10zM4 10h4v1h-4zM5 11h3v1h-3zM6 12h2v1h-2zM7 13h1v1h-1z", "arrow-right": "M8 2h1v1h-1zM8 3h2v1h-2zM8 4h3v1h-3zM8 5h4v1h-4zM2 6h10v1h-10zM2 7h11v1h-11zM2 8h11v1h-11zM2 9h10v1h-10zM8 10h4v1h-4zM8 11h3v1h-3zM8 12h2v1h-2zM8 13h1v1h-1z", "cursor": "M1 0h1v1h-1zM1 1h2v1h-2zM1 2h1v1h-1zM3 2h1v1h-1zM1 3h1v1h-1zM4 3h1v1h-1zM1 4h1v1h-1zM5 4h1v1h-1zM1 5h1v1h-1zM6 5h1v1h-1zM1 6h1v1h-1zM7 6h1v1h-1zM1 7h1v1h-1zM8 7h1v1h-1zM1 8h1v1h-1zM9 8h1v1h-1zM1 9h1v1h-1zM6 9h5v1h-5zM1 10h1v1h-1zM4 10h1v1h-1zM6 10h1v1h-1zM1 11h1v1h-1zM3 11h1v1h-1zM6 11h1v1h-1zM1 12h2v1h-2zM7 12h1v1h-1zM1 13h1v1h-1zM7 13h1v1h-1zM8 14h1v1h-1z"};

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(" ");
  }
  function rest(props, omit) {
    var o = {};
    for (var k in props) if (Object.prototype.hasOwnProperty.call(props, k) && omit.indexOf(k) < 0) o[k] = props[k];
    return o;
  }

  function PixelIcon(props) {
    var size = props.size || 16;
    var d = PATHS[props.name] || "";
    return h("svg", Object.assign(rest(props, ["name", "size", "className", "label"]), {
      className: cx("pp-icon", props.className),
      viewBox: "0 0 16 16", width: size, height: size,
      shapeRendering: "crispEdges",
      role: props.label ? "img" : undefined,
      "aria-label": props.label || undefined,
      "aria-hidden": props.label ? undefined : true
    }), h("path", { d: d, fill: "currentColor" }));
  }

  function Button(props) {
    var tone = props.tone || "cream";
    var size = props.size || "md";
    var iconOnly = props.icon && props.children == null;
    return h("button", Object.assign({ type: "button" }, rest(props, ["tone", "size", "icon", "className", "children"]), {
      className: cx("pp-btn", "pp-btn-" + tone, "pp-btn-" + size, iconOnly ? "pp-btn-icon" : null, props.className)
    }), props.icon ? h(PixelIcon, { name: props.icon, size: 16 }) : null,
      props.children != null ? h("span", null, props.children) : null);
  }

  function Slider(props) {
    var min = props.min == null ? 0 : props.min, max = props.max == null ? 100 : props.max;
    var v = props.value == null ? (props.defaultValue == null ? min : props.defaultValue) : props.value;
    var st = React.useState(v), val = props.value == null ? st[0] : props.value;
    var pct = (val - min) / (max - min) * 100;
    return h("label", { className: cx("pp-slider", "pp-slider-" + (props.tone || "yellow"), "pp-knob-" + (props.knob || "round"), props.className) },
      props.label ? h("span", { className: "pp-field-label" }, props.label) : null,
      h("input", Object.assign(rest(props, ["label", "tone", "knob", "className", "value", "defaultValue", "onChange"]), {
        type: "range", min: min, max: max, value: val, className: "pp-range",
        style: { "--pp-fill": pct + "%" },
        onChange: function (e) { st[1](Number(e.target.value)); if (props.onChange) props.onChange(e); }
      })));
  }

  function Window(props) {
    var tone = props.tone || "teal";
    var controls = props.controls === undefined ? ["minimize", "maximize", "close"] : props.controls;
    return h("section", Object.assign(rest(props, ["title", "tone", "controls", "onControl", "footer", "striped", "className", "children", "icon"]), {
      className: cx("pp-window", props.className),
      "aria-label": props.title
    }),
      h("header", { className: cx("pp-titlebar", "pp-tone-" + tone, props.striped ? "pp-striped" : null) },
        props.icon ? h(PixelIcon, { name: props.icon }) : null,
        h("span", { className: "pp-title" }, props.title),
        h("span", { className: "pp-controls" }, controls.map(function (c) {
          return h("button", {
            key: c, type: "button", className: "pp-ctl", "aria-label": c,
            onClick: props.onControl ? function () { props.onControl(c); } : undefined
          }, h(PixelIcon, { name: c, size: 16 }));
        }))),
      h("div", { className: "pp-window-body" }, props.children),
      props.footer ? h("footer", { className: "pp-window-footer" }, props.footer) : null);
  }

  var DIALOG_ICON = { info: "info", warning: "warning", error: "close", success: "check" };
  var DIALOG_TONE = { info: "teal", warning: "yellow", error: "orange", success: "green" };
  var DIALOG_TITLE = { info: "Info", warning: "Warning", error: "Error", success: "Done" };
  function Dialog(props) {
    var kind = props.kind || "info";
    return h(Window, {
      title: props.title || DIALOG_TITLE[kind], tone: DIALOG_TONE[kind], controls: ["close"],
      onControl: props.onClose, className: cx("pp-dialog", props.className), role: "alertdialog"
    },
      h("div", { className: "pp-dialog-row" },
        h("span", { className: cx("pp-dialog-icon", "pp-tone-" + DIALOG_TONE[kind]) }, h(PixelIcon, { name: DIALOG_ICON[kind], size: 32 })),
        h("p", { className: "pp-dialog-msg" }, props.children)),
      props.actions ? h("div", { className: "pp-dialog-actions" }, props.actions) : null);
  }

  var fieldId = 0;
  function TextField(props) {
    var idRef = React.useRef(null);
    if (!idRef.current) idRef.current = props.id || "pp-field-" + (++fieldId);
    var id = idRef.current;
    var input = h(props.multiline ? "textarea" : "input", Object.assign(rest(props, ["label", "hint", "error", "multiline", "className", "id", "icon"]), {
      id: id, className: "pp-input", "aria-invalid": props.error ? true : undefined
    }));
    return h("div", { className: cx("pp-field", props.error ? "pp-field-error" : null, props.className) },
      props.label ? h("label", { className: "pp-field-label", htmlFor: id }, props.label) : null,
      props.icon ? h("div", { className: "pp-input-wrap" },
        h("span", { className: "pp-input-icon pp-tone-teal", "aria-hidden": true }, h(PixelIcon, { name: props.icon })), input) : input,
      props.error ? h("span", { className: "pp-field-msg pp-field-msg-error" }, h(PixelIcon, { name: "warning" }), props.error)
        : props.hint ? h("span", { className: "pp-field-msg" }, props.hint) : null);
  }

  function Checkbox(props) {
    return h("label", { className: cx("pp-check", props.disabled ? "pp-disabled" : null, props.className) },
      h("input", Object.assign({ type: "checkbox" }, rest(props, ["label", "className", "children"]), { className: "pp-check-input" })),
      h("span", { className: "pp-check-box", "aria-hidden": true }, h(PixelIcon, { name: "check" })),
      h("span", { className: "pp-check-label" }, props.label || props.children));
  }

  function ProgressBar(props) {
    var segments = props.segments || 12;
    var value = Math.max(0, Math.min(100, props.value || 0));
    var filled = Math.round(value / 100 * segments);
    var cells = [];
    for (var i = 0; i < segments; i++) cells.push(h("span", { key: i, className: cx("pp-seg", i < filled ? "pp-seg-on" : null) }));
    return h("div", { className: cx("pp-progress", "pp-progress-" + (props.tone || "blue"), props.className) },
      props.label ? h("div", { className: "pp-progress-head" },
        h("span", null, props.label), h("span", { className: "pp-progress-pct" }, Math.round(value) + "%")) : null,
      h("div", { className: "pp-progress-track", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(value), "aria-label": props.label }, cells));
  }

  function Badge(props) {
    return h("span", { className: cx("pp-badge", "pp-tone-" + (props.tone || "yellow"), props.className) },
      props.icon ? h(PixelIcon, { name: props.icon }) : null, props.children);
  }

  function SpeechBubble(props) {
    return h("div", { className: cx("pp-bubble", "pp-bubble-" + (props.tail || "left"), props.from === "me" ? "pp-bubble-me" : null, props.className) },
      props.name ? h("span", { className: "pp-bubble-name" }, props.name) : null,
      h("div", { className: "pp-bubble-text" }, props.children));
  }

  window.PixelPop = Object.assign(window.PixelPop || {}, {
    Window: Window, Dialog: Dialog, Button: Button, TextField: TextField, Checkbox: Checkbox,
    ProgressBar: ProgressBar, Slider: Slider, Badge: Badge, SpeechBubble: SpeechBubble, PixelIcon: PixelIcon,
    iconNames: Object.keys(PATHS)
  });
})();
