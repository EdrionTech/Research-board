// Pen writing: draw or handwrite with a pen, finger or mouse (tablets, phones, touchscreens, drawing pads) in a
// pad over the page, and keep it in the text as an image: ![Drawing](asset:ID).
// The image is an SVG (sharp at any size, shows anywhere an image does, and exports as one) holding the strokes
// themselves in its <metadata>, so opening it again carries on the same drawing.
// A pen's pressure makes lines thicker or thinner. Once a pen has touched the pad, fingers are ignored
// (a hand resting on the screen doesn't draw).
// MdBar puts a ✎ Draw button on every Markdown text box; with the cursor in a drawing's ![…](asset:…), it edits it.
// Later: handwriting turned into text, and writing straight on a material's pages.

const Sketch = (() => {
    // the pad's size in drawing units: wide (1200 × 800), or tall (800 × 1200) on a phone held upright;
    // a saved drawing opens again at the size it was drawn at
    let W = 1200;
    let H = 800;
    const COLORS = ['#1f2328', '#1c5fd4', '#c62828', '#2e7d32', '#e8a400'];
    const SIZES = { thin: 2.2, medium: 4.5, thick: 9 };
    const ALT = 'Drawing';

    let box = null;     // the pad's elements, made once
    let canvas, ctx;
    let strokes = [];   // [{ tool: 'pen' | 'marker', color, size, points: [[x, y, pressure]] }]
    let undone = [];
    let tool = 'pen';
    let color = COLORS[0];
    let size = 'medium';
    let drawing = null; // the stroke being drawn
    let penSeen = false;
    let onSave = null;

    // ---- a stroke as a filled outline (so pressure can vary its width), the same path for the canvas and the SVG ----

    function outline(stroke) {
        const pts = stroke.points;
        const base = SIZES[stroke.size] * (stroke.tool === 'marker' ? 3.2 : 1);
        const widthAt = p => (stroke.tool === 'marker' ? base : base * (0.35 + 0.95 * (p[2] ?? 0.5)));
        if (pts.length === 1) {
            const [x, y] = pts[0];
            const r = widthAt(pts[0]) / 2;
            return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
        }
        const left = [];
        const right = [];
        for (let i = 0; i < pts.length; i++) {
            const a = pts[Math.max(0, i - 1)];
            const b = pts[Math.min(pts.length - 1, i + 1)];
            let dx = b[0] - a[0];
            let dy = b[1] - a[1];
            const len = Math.hypot(dx, dy) || 1;
            dx /= len;
            dy /= len;
            const r = widthAt(pts[i]) / 2;
            left.push([pts[i][0] - dy * r, pts[i][1] + dx * r]);
            right.push([pts[i][0] + dy * r, pts[i][1] - dx * r]);
        }
        // round ends: half circles at the start and the end
        const end = pts.at(-1);
        const rEnd = widthAt(end) / 2;
        const rStart = widthAt(pts[0]) / 2;
        const line = list => list.map(([x, y]) => `L${f(x)} ${f(y)}`).join('');
        return `M${f(left[0][0])} ${f(left[0][1])}${line(left.slice(1))}`
            + `A${f(rEnd)} ${f(rEnd)} 0 0 1 ${f(right.at(-1)[0])} ${f(right.at(-1)[1])}`
            + `${line(right.slice(0, -1).reverse())}`
            + `A${f(rStart)} ${f(rStart)} 0 0 1 ${f(left[0][0])} ${f(left[0][1])}Z`;
    }
    const f = n => Math.round(n * 10) / 10;
    const opacity = stroke => (stroke.tool === 'marker' ? 0.35 : 1);

    function redraw() {
        ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H);
        for (const s of drawing ? [...strokes, drawing] : strokes) {
            ctx.globalAlpha = opacity(s);
            ctx.fillStyle = s.color;
            ctx.fill(new Path2D(outline(s)));
        }
        ctx.globalAlpha = 1;
        $('[data-sk="undo"]', box).disabled = !strokes.length;
        $('[data-sk="redo"]', box).disabled = !undone.length;
        $('[data-sk="clear"]', box).disabled = !strokes.length;
    }

    // ---- the SVG: cropped to what's drawn (plus a margin); the strokes kept in its metadata ----

    function toSvg() {
        let [x0, y0, x1, y1] = [W, H, 0, 0];
        for (const s of strokes) {
            const pad = SIZES[s.size] * 4;
            for (const [x, y] of s.points) {
                x0 = Math.min(x0, x - pad); y0 = Math.min(y0, y - pad);
                x1 = Math.max(x1, x + pad); y1 = Math.max(y1, y + pad);
            }
        }
        x0 = Math.max(0, x0 - 16); y0 = Math.max(0, y0 - 16);
        x1 = Math.min(W, x1 + 16); y1 = Math.min(H, y1 + 16);
        const vw = f(x1 - x0);
        const vh = f(y1 - y0);
        const paths = strokes.map(s => `<path d="${outline(s)}" fill="${s.color}"${s.tool === 'marker' ? ' fill-opacity="0.35"' : ''}/>`).join('');
        const data = JSON.stringify({ v: 1, w: W, h: H, strokes }).replace(/</g, '\\u003c').replace(/&/g, '\\u0026');
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x0)} ${f(y0)} ${vw} ${vh}" width="${vw}" height="${vh}">`
            + `<metadata id="research-board-sketch">${data}</metadata>`
            + `<rect x="${f(x0)}" y="${f(y0)}" width="${vw}" height="${vh}" fill="#fff"/>${paths}</svg>`;
    }

    // a saved drawing: { strokes, w, h } (null if it isn't one of these)
    async function strokesOf(blob) {
        if (!blob || !/svg/.test(blob.type)) return null;
        const text = await blob.text();
        const json = text.match(/<metadata id="research-board-sketch">([\s\S]*?)<\/metadata>/)?.[1];
        try {
            const data = json && JSON.parse(json);
            return data?.strokes ? { strokes: data.strokes, w: data.w || 1200, h: data.h || 800 } : null;
        } catch {
            return null;
        }
    }

    // ---- the pad ----

    function build() {
        box = el('div', 'sketch');
        box.hidden = true;
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-label', 'Draw');
        const button = (sk, label, title, value) => {
            const b = el('button', 'sketch_btn', label);
            b.type = 'button';
            b.dataset.sk = sk;
            if (value) b.dataset.value = value;
            b.title = title;
            return b;
        };
        const tools = el('div', 'sketch_group');
        tools.append(button('tool', '✎ Pen', 'Pen: pressing harder draws thicker', 'pen'),
            button('tool', '▮ Marker', 'Marker: wide and see-through, to highlight', 'marker'),
            button('tool', '⌫ Eraser', 'Eraser: rubs out whole strokes', 'eraser'));
        const colors = el('div', 'sketch_group');
        for (const c of COLORS) {
            const b = button('color', '', 'Colour', c);
            b.classList.add('sketch_color');
            b.style.setProperty('--c', c);
            colors.append(b);
        }
        const sizes = el('div', 'sketch_group');
        sizes.append(button('size', '·', 'Thin', 'thin'), button('size', '•', 'Medium', 'medium'), button('size', '●', 'Thick', 'thick'));
        const edits = el('div', 'sketch_group');
        edits.append(button('undo', '↶', 'Undo (Ctrl + Z)'), button('redo', '↷', 'Redo (Ctrl + Y)'), button('clear', 'Clear', 'Rub out everything'));
        const bar = el('div', 'sketch_bar');
        bar.append(tools, colors, sizes, edits);

        canvas = el('canvas', 'sketch_canvas');
        ctx = canvas.getContext('2d');
        const stage = el('div', 'sketch_stage');
        stage.append(canvas);

        const actions = el('div', 'sketch_actions');
        actions.append(el('small', 'sketch_hint', 'Draw with a pen, a finger or the mouse.'), el('span', 'spacer'),
            button('cancel', 'Cancel', 'Close without saving (Esc)'), button('save', 'Save drawing', 'Put it in the text'));
        $('[data-sk="save"]', actions).classList.add('primary');

        const panel = el('div', 'sketch_panel');
        panel.append(bar, stage, actions);
        box.append(panel);
        document.body.append(box);

        bar.addEventListener('click', e => {
            const b = e.target.closest('[data-sk]');
            if (!b) return;
            const sk = b.dataset.sk;
            if (sk === 'tool') tool = b.dataset.value;
            else if (sk === 'color') { color = b.dataset.value; if (tool === 'eraser') tool = 'pen'; }
            else if (sk === 'size') size = b.dataset.value;
            else if (sk === 'undo' && strokes.length) undone.push(strokes.pop());
            else if (sk === 'redo' && undone.length) strokes.push(undone.pop());
            else if (sk === 'clear' && strokes.length && confirm('Rub out the whole drawing?')) { undone = []; strokes = []; }
            showChoices();
            redraw();
        });
        actions.addEventListener('click', e => {
            const sk = e.target.closest('[data-sk]')?.dataset.sk;
            if (sk === 'cancel') close();
            if (sk === 'save') save();
        });
        box.addEventListener('keydown', e => {
            if (e.key === 'Escape') { e.stopPropagation(); close(); }
            const key = e.key.toLowerCase();
            if ((e.ctrlKey || e.metaKey) && (key === 'z' || key === 'y')) {
                e.preventDefault();
                $(`[data-sk="${key === 'y' || e.shiftKey ? 'redo' : 'undo'}"]`, box).click();
            }
        });

        canvas.addEventListener('pointerdown', down);
        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', up);
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        new ResizeObserver(fit).observe(stage);
    }

    function showChoices() {
        for (const b of $$('[data-sk="tool"]', box)) b.setAttribute('aria-pressed', b.dataset.value === tool);
        for (const b of $$('[data-sk="color"]', box)) b.setAttribute('aria-pressed', b.dataset.value === color && tool !== 'eraser');
        for (const b of $$('[data-sk="size"]', box)) b.setAttribute('aria-pressed', b.dataset.value === size);
        canvas.dataset.tool = tool;
    }

    // the canvas as big as fits, at the screen's sharpness, keeping the pad's 3:2 shape
    function fit() {
        const stage = canvas.parentElement;
        const scale = Math.min(stage.clientWidth / W, stage.clientHeight / H);
        if (!scale) return;
        canvas.style.width = W * scale + 'px';
        canvas.style.height = H * scale + 'px';
        const dpr = Math.min(2, devicePixelRatio || 1);
        canvas.width = Math.round(W * scale * dpr);
        canvas.height = Math.round(H * scale * dpr);
        redraw();
    }

    const pointOf = e => {
        const r = canvas.getBoundingClientRect();
        // a mouse or finger has no pressure: a steady middle width
        const pressure = e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5;
        return [f((e.clientX - r.left) / r.width * W), f((e.clientY - r.top) / r.height * H), Math.round(pressure * 100) / 100];
    };

    function down(e) {
        if (e.pointerType === 'pen') penSeen = true;
        else if (e.pointerType === 'touch' && penSeen) return; // a resting hand
        if (e.button > 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        try { canvas.setPointerCapture(e.pointerId); } catch { }
        // a pen's eraser end (or its button) rubs out
        const erasing = tool === 'eraser' || e.button === 5 || (e.buttons & 32);
        drawing = erasing ? { erase: true, id: e.pointerId } : { tool, color, size, points: [pointOf(e)], id: e.pointerId };
        if (erasing) eraseAt(pointOf(e));
        redraw();
    }

    function move(e) {
        if (!drawing || e.pointerId !== drawing.id) return;
        const events = e.getCoalescedEvents?.() || [e];
        for (const ev of events) {
            const p = pointOf(ev);
            if (drawing.erase) eraseAt(p);
            else {
                const last = drawing.points.at(-1);
                if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 1.2) drawing.points.push(p);
            }
        }
        if (drawing.erase) redraw();
        else requestAnimationFrame(redraw);
    }

    function up(e) {
        if (!drawing || e.pointerId !== drawing.id) return;
        if (!drawing.erase) {
            const { id, ...stroke } = drawing;
            strokes.push(stroke);
            undone = [];
        }
        drawing = null;
        redraw();
    }

    // the eraser rubs out every stroke it passes over
    function eraseAt([x, y]) {
        const reach = 14;
        const before = strokes.length;
        const kept = strokes.filter(s => !s.points.some(([px, py]) => Math.hypot(px - x, py - y) < reach + SIZES[s.size]));
        if (kept.length !== before) {
            undone = [];
            strokes = kept;
        }
    }

    function open(start, save) {
        if (!box) build();
        strokes = (start?.strokes || []).map(s => ({ ...s, points: s.points.map(p => [...p]) }));
        undone = [];
        drawing = null;
        onSave = save;
        box.hidden = false;
        const stage = canvas.parentElement;
        [W, H] = start ? [start.w, start.h] : stage.clientHeight > stage.clientWidth * 1.15 ? [800, 1200] : [1200, 800];
        document.body.classList.add('sketching');
        showChoices();
        fit();
        $('[data-sk="tool"][aria-pressed="true"]', box)?.focus();
    }

    function close() {
        box.hidden = true;
        document.body.classList.remove('sketching');
        onSave = null;
    }

    async function save() {
        if (!strokes.length) return close();
        const done = onSave;
        const blob = new Blob([toSvg()], { type: 'image/svg+xml' });
        const kept = strokes;
        close();
        await done?.(blob, kept);
    }

    // ---- in a Markdown text box ----

    // the drawing whose ![…](asset:ID) the cursor is in, if any: { id, start, end }
    function drawingAtCursor(area) {
        const { value, selectionStart: at } = area;
        for (const m of value.matchAll(/!\[[^\]]*\]\(asset:([a-z0-9]+)\)/gi)) {
            if (at >= m.index && at <= m.index + m[0].length) return { id: m[1], start: m.index, end: m.index + m[0].length };
        }
        return null;
    }

    // ✎ Draw: a new drawing at the cursor, or (cursor in a drawing's image) that drawing again
    async function draw(area) {
        const here = drawingAtCursor(area);
        const old = here && await strokesOf(await Store.getAsset(here.id).catch(() => null));
        open(old, async blob => {
            let id;
            try {
                id = await Store.putAsset(blob);
            } catch {
                alert("Couldn't save the drawing (storage full, or no connection?).");
                return;
            }
            const md = `![${ALT}](asset:${id})`;
            if (old) {
                area.focus();
                area.setSelectionRange(here.start, here.end);
                MdBar.replace(area, here.start, here.end, md); // the old image stays: a note not saved still uses it
            } else {
                const { selectionStart: start, selectionEnd: end, value } = area;
                const before = start > 0 && value[start - 1] !== '\n' ? '\n' : '';
                MdBar.replace(area, start, end, `${before}${md}\n`);
            }
        });
    }

    // a drawing's image elsewhere (e.g. the note form's image strip): edit it in `area`
    async function edit(area, id) {
        const i = area.value.indexOf(`(asset:${id})`);
        if (i < 0) return false;
        const old = await strokesOf(await Store.getAsset(id).catch(() => null));
        if (!old) return false;
        area.focus();
        area.setSelectionRange(i + 2, i + 2);
        await draw(area);
        return true;
    }

    return { draw, edit, open, strokesOf };
})();
