// Reader zoom: − / + buttons, two-finger pinch on phones and tablets, Ctrl + wheel or a trackpad pinch on a computer.
// - PDF: the pages get wider than the reader (scroll sideways); drawn again at the new size so they stay sharp.
// - HTML paper and pasted text: the text gets bigger and re-flows to the width, so nothing scrolls sideways.
// While fingers move, the view is only scaled with a CSS transform (cheap); the real zoom is set on release.
// Each kind of view remembers its zoom on this device (a phone wants bigger text than a laptop).

const ReaderZoom = (() => {
    const KEY = 'research_board_zoom';
    const LIMITS = { pdf: [0.5, 4], html: [0.7, 2.5], text: [0.7, 2.5] };
    const STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

    const clamp = (view, z) => Math.min(LIMITS[view][1], Math.max(LIMITS[view][0], Math.round(z * 100) / 100));

    function saved(view) {
        try {
            const z = Number(JSON.parse(localStorage.getItem(KEY) || '{}')[view]);
            return z ? clamp(view, z) : 1;
        } catch {
            return 1;
        }
    }

    function remember(view, z) {
        try {
            const all = JSON.parse(localStorage.getItem(KEY) || '{}');
            all[view] = z;
            localStorage.setItem(KEY, JSON.stringify(all));
        } catch { /* storage unavailable: forgotten next time */ }
    }

    // the next step up (dir 1) or down (dir -1) from z
    function step(view, z, dir) {
        const next = dir > 0 ? STEPS.find(s => s > z + 0.001) : [...STEPS].reverse().find(s => s < z - 0.001);
        return clamp(view, next ?? z);
    }

    // Pinch and Ctrl + wheel on `el` (in `doc`, e.g. the paper's frame). onPreview(scale, x, y) runs while the
    // gesture moves (scale 1 = put it back); onCommit(scale, x, y) once at the end. x/y: the gesture's centre.
    function gestures(el, { onPreview, onCommit }) {
        let start = null;
        let scale = 1;
        const centre = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
        const spread = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

        el.addEventListener('touchstart', e => {
            if (e.touches.length !== 2) return;
            const [a, b] = e.touches;
            start = { dist: spread(a, b) || 1, ...centre(a, b) };
            scale = 1;
        }, { passive: true });
        el.addEventListener('touchmove', e => {
            if (!start || e.touches.length !== 2) return;
            e.preventDefault(); // two fingers zoom the reader, not the whole app
            scale = spread(...e.touches) / start.dist;
            onPreview(scale, start.x, start.y);
        }, { passive: false });
        const end = () => {
            if (!start) return;
            const s = start;
            start = null;
            if (Math.abs(scale - 1) > 0.03) onCommit(scale, s.x, s.y);
            else onPreview(1, s.x, s.y);
        };
        el.addEventListener('touchend', e => { if (e.touches.length < 2) end(); });
        el.addEventListener('touchcancel', end);

        // trackpad pinch arrives as wheel events with ctrlKey; so does Ctrl + mouse wheel
        let wheel = null;
        let timer = 0;
        el.addEventListener('wheel', e => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            wheel ??= { scale: 1, x: e.clientX, y: e.clientY };
            wheel.scale *= Math.exp(-e.deltaY * 0.01);
            onPreview(wheel.scale, wheel.x, wheel.y);
            clearTimeout(timer);
            timer = setTimeout(() => {
                const w = wheel;
                wheel = null;
                onCommit(w.scale, w.x, w.y);
            }, 200);
        }, { passive: false });
    }

    // The element at a point and where it sits, so text that re-flows can be scrolled back under the fingers.
    function anchorAt(doc, x, y) {
        const target = doc.elementFromPoint(x, y);
        if (!target || target === doc.body || target === doc.documentElement) return null;
        const rect = target.getBoundingClientRect();
        return { target, y, ratio: rect.height ? (y - rect.top) / rect.height : 0 };
    }

    function restoreAnchor(anchor, scroller) {
        if (!anchor?.target.isConnected) return;
        const rect = anchor.target.getBoundingClientRect();
        scroller.scrollBy(0, rect.top + anchor.ratio * rect.height - anchor.y);
    }

    return { LIMITS, clamp, saved, remember, step, gestures, anchorAt, restoreAnchor };
})();
