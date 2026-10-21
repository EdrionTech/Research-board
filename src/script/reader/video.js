// Video player for video sources: YouTube, Vimeo, or a video file / direct link.
// mount(container, info) resolves to a player with the same small API for all of them:
//   getTime(), getDuration() -> Promise<seconds>;  seek(seconds);  play();  pause();  destroy()
// YouTube and Vimeo players are their official embeds, loaded the first time they're needed.

const VideoPlayer = (() => {
    const scripts = {};
    const loadScript = src => scripts[src] ??= new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error("couldn't load the video player (offline?)"));
        document.head.append(script);
    });

    async function youtube(container, id) {
        if (!window.YT?.Player) {
            const ready = new Promise(resolve => {
                const previous = window.onYouTubeIframeAPIReady;
                window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(); };
            });
            await loadScript('https://www.youtube.com/iframe_api');
            await ready;
        }
        const host = document.createElement('div');
        container.append(host);
        const player = await new Promise(resolve => {
            const p = new YT.Player(host, {
                videoId: id,
                width: '100%',
                height: '100%',
                playerVars: { rel: 0, playsinline: 1 },
                events: { onReady: () => resolve(p) },
            });
        });
        return {
            getTime: async () => player.getCurrentTime() || 0,
            getDuration: async () => player.getDuration() || 0,
            seek: seconds => player.seekTo(seconds, true),
            play: () => player.playVideo(),
            pause: () => player.pauseVideo(),
            destroy: () => player.destroy(),
        };
    }

    async function vimeo(container, id) {
        await loadScript('https://cdn.jsdelivr.net/npm/@vimeo/player@2.24.0/dist/player.min.js');
        const host = document.createElement('div');
        container.append(host);
        const player = new Vimeo.Player(host, { id, dnt: true });
        await player.ready();
        return {
            getTime: () => player.getCurrentTime(),
            getDuration: () => player.getDuration(),
            seek: seconds => player.setCurrentTime(seconds),
            play: () => player.play(),
            pause: () => player.pause(),
            destroy: () => player.destroy(),
        };
    }

    function file(container, src) {
        const video = document.createElement('video');
        video.controls = true;
        video.preload = 'metadata';
        video.src = src;
        container.append(video);
        // Recordings made in a browser (screen or lecture recordings) don't say how long they are (duration Infinity),
        // so where you are couldn't be worked out or resumed: a seek far past the end makes the browser find it.
        // Meanwhile a seek (continuing where you were) waits, and happens once the length is known.
        let finding = false;
        let wanted = 0;
        video.addEventListener('loadedmetadata', () => {
            if (video.duration !== Infinity) return;
            finding = true;
            wanted = video.currentTime; // a seek asked for before the video loaded
            video.addEventListener('durationchange', () => {
                finding = false;
                video.currentTime = wanted;
            }, { once: true });
            video.currentTime = 1e101;
        }, { once: true });
        return {
            getTime: async () => (finding ? wanted : video.currentTime),
            getDuration: async () => (Number.isFinite(video.duration) ? video.duration : 0),
            seek: seconds => {
                if (finding) wanted = seconds;
                else video.currentTime = seconds;
            },
            play: () => video.play().catch(() => { }),
            pause: () => video.pause(),
            destroy: () => {
                video.removeAttribute('src');
                video.load();
                video.remove();
            },
        };
    }

    // info from videoInfo() in sources.js; `src` filled in for uploaded files
    async function mount(container, info) {
        container.replaceChildren();
        if (info.provider === 'youtube') return youtube(container, info.id);
        if (info.provider === 'vimeo') return vimeo(container, info.id);
        return file(container, info.src);
    }

    return { mount };
})();

// 75 -> "1:15", 3725 -> "1:02:05"
function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const pad = n => String(n).padStart(2, '0');
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
