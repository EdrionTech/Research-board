// Time spent reading: active time only. It counts while the page is shown and you've done something in the last
// two minutes (scrolled, clicked, typed), so a coffee break doesn't count. One timer for the reader: reading in
// passes uses it (material_passes.js), and full-screen reading's clock is to use it too (roadmap).
//   const timer = ReadingTimer.create({ onTick(ms), onFlush(ms) })
//   timer.watch(doc)      count activity in this document too (the HTML paper's frame)
//   timer.start() / timer.stop()
//   timer.pending()       counted and not yet handed to onFlush
//   timer.flush()         hands what's counted to onFlush (every 30 s, when the page is hidden or closed)
// "4:05", "1:02:30": ReadingTimer.clock(ms)

const ReadingTimer = (() => {
    const IDLE = 120000;
    const FLUSH_EVERY = 30000;

    function create({ onTick = () => { }, onFlush = () => { } } = {}) {
        let last = Date.now();
        let pending = 0;
        let tick = null;
        const touch = () => { last = Date.now(); };

        function step() {
            if (document.hidden || Date.now() - last > IDLE) return;
            pending += 1000;
            if (pending >= FLUSH_EVERY) flush();
            onTick(pending);
        }
        function flush() {
            if (!pending) return;
            const ms = pending;
            pending = 0;
            onFlush(ms);
        }
        function start() {
            clearInterval(tick);
            touch();
            tick = setInterval(step, 1000);
        }
        function stop() {
            clearInterval(tick);
            tick = null;
            flush();
        }
        function watch(doc) {
            for (const type of ['pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart']) doc.addEventListener(type, touch, { capture: true, passive: true });
        }

        watch(document);
        addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
        addEventListener('pagehide', flush);
        return { start, stop, flush, watch, touch, pending: () => pending };
    }

    function clock(ms) {
        const t = Math.floor((ms || 0) / 1000);
        const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = String(t % 60).padStart(2, '0');
        return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
    }

    return { create, clock };
})();
