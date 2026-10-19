// Taking images from what you're reading (the 📷 Capture tools on the material page).
// Each function resolves to a PNG Blob:
//   pdfRegion(page, region)       part of a PDF page, drawn again at high resolution
//   imageRegion(url, region)      part of a web image (works when the site allows it, e.g. arXiv)
//   videoFrame(video, region?)    the current frame of an uploaded or directly linked video
//   screenRect(getRect)           anything else on screen (YouTube, page text…): Chrome asks to share
//                                 this tab, one frame is taken and the tab sharing stops straight away
// plus dragBox(area): lets you drag a box over an element, resolves to the box (screen coordinates).
// Regions are { x, y, w, h } in fractions (0–1) of the page / image / frame.

const Capture = (() => {
    const toBlob = canvas => new Promise((resolve, reject) =>
        canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('could not make the image'))), 'image/png'));

    // copy part of a drawable (canvas, image, video frame) of size w x h into a new image
    function crop(drawable, w, h, region = { x: 0, y: 0, w: 1, h: 1 }) {
        const sx = Math.round(region.x * w);
        const sy = Math.round(region.y * h);
        const sw = Math.max(1, Math.round(region.w * w));
        const sh = Math.max(1, Math.round(region.h * h));
        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        canvas.getContext('2d').drawImage(drawable, sx, sy, sw, sh, 0, 0, sw, sh);
        return toBlob(canvas);
    }

    // the chosen part comes out about 1600 px wide (the whole page at most ~6000 px)
    async function pdfRegion(page, region) {
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(6000 / base.width, Math.max(2, 1600 / (region.w * base.width)));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        return crop(canvas, canvas.width, canvas.height, region);
    }

    async function imageRegion(url, region) {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error('image not available');
        const bitmap = await createImageBitmap(await res.blob());
        return crop(bitmap, bitmap.width, bitmap.height, region);
    }

    function videoFrame(video, region) {
        if (!video.videoWidth) throw new Error('the video has no frame yet');
        return crop(video, video.videoWidth, video.videoHeight, region);
    }

    // where the picture actually is inside a <video> element (it's letterboxed to keep its shape)
    function videoContentRect(video) {
        const box = video.getBoundingClientRect();
        const ratio = video.videoWidth / video.videoHeight || 16 / 9;
        const width = Math.min(box.width, box.height * ratio);
        const height = width / ratio;
        return new DOMRect(box.left + (box.width - width) / 2, box.top + (box.height - height) / 2, width, height);
    }

    // getRect() is asked after sharing starts (Chrome may show a bar that moves the page)
    async function screenRect(getRect) {
        if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('this browser cannot take screenshots of the page');
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include',
        });
        try {
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            await video.play();
            await new Promise(resolve => setTimeout(resolve, 350)); // a fresh frame, after any layout change
            const rect = getRect();
            const sx = video.videoWidth / innerWidth;
            const sy = video.videoHeight / innerHeight;
            return crop(video, video.videoWidth, video.videoHeight, {
                x: (rect.left * sx) / video.videoWidth,
                y: (rect.top * sy) / video.videoHeight,
                w: (rect.width * sx) / video.videoWidth,
                h: (rect.height * sy) / video.videoHeight,
            });
        } finally {
            stream.getTracks().forEach(track => track.stop());
        }
    }

    // A see-through layer over `area` (its visible part); drag a box, Esc cancels. Resolves to a DOMRect or null.
    function dragBox(area) {
        return new Promise(resolve => {
            const bounds = area.getBoundingClientRect();
            const top = Math.max(0, bounds.top);
            const bottom = Math.min(innerHeight, bounds.bottom);
            const layer = el('div', 'capture_layer');
            Object.assign(layer.style, { left: bounds.left + 'px', top: top + 'px', width: bounds.width + 'px', height: (bottom - top) + 'px' });
            layer.append(el('div', 'capture_hint', 'Drag a box over what you want to capture · Esc to cancel'));
            const box = el('div', 'capture_box');
            layer.append(box);
            document.body.append(layer);

            let start = null;
            const done = rect => {
                layer.remove();
                document.removeEventListener('keydown', onKey);
                resolve(rect);
            };
            const onKey = e => { if (e.key === 'Escape') done(null); };
            const rectFrom = e => new DOMRect(Math.min(start.x, e.clientX), Math.min(start.y, e.clientY),
                Math.abs(e.clientX - start.x), Math.abs(e.clientY - start.y));

            layer.addEventListener('pointerdown', e => {
                start = { x: e.clientX, y: e.clientY };
                layer.setPointerCapture(e.pointerId);
            });
            layer.addEventListener('pointermove', e => {
                if (!start) return;
                const r = rectFrom(e);
                Object.assign(box.style, { display: 'block', left: (r.left - bounds.left) + 'px', top: (r.top - top) + 'px', width: r.width + 'px', height: r.height + 'px' });
            });
            layer.addEventListener('pointerup', e => {
                const r = rectFrom(e);
                done(r.width > 8 && r.height > 8 ? r : null);
            });
            document.addEventListener('keydown', onKey);
        });
    }

    return { pdfRegion, imageRegion, videoFrame, videoContentRect, screenRect, dragBox };
})();
