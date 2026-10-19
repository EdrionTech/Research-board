// App-wide settings for this browser: theme, style and your own CSS.
// Every page loads this in its <head> (after its stylesheets). While the page is still loading, the
// style's stylesheets are written straight into the <head>, so the browser waits for them before it
// draws anything: no flash of the wrong style between pages. It also sets
// <html data-theme="light|dark" data-style="…">.
//
// Styles: each is a set of stylesheets in style/themes/<name>/ that re-dress the app's parts (bars,
// buttons, panels, inputs…) on top of base.css. To add one, put its CSS there and add it to STYLES.
// A style with images: true also has default pictures for projects that have none of their own:
// style/themes/<name>/images/project-cover-light|dark.svg (16:9) and project-thumb-light|dark.svg (square).

const Settings = (() => {
    const KEY = 'research_board_settings';
    const DEFAULTS = { theme: 'system', style: 'default', customCss: '' };

    const STYLES = {
        default: {
            label: 'Default',
            description: 'Calm and clean: soft cards, rounded corners.',
            css: [],
            swatch: ['#f4f2ee', '#ffffff', '#3d5afe', '#1f1d1a'],
        },
        'pixel-pop': {
            label: 'Pixel Pop',
            description: 'A cheerful retro desktop: cream windows on a blue grid, pixel outlines, candy keys.',
            // fonts wait briefly (display=block) rather than swapping in later, which looked like a flash
            fonts: 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;600;700&family=Nunito:wght@400;600;800&family=JetBrains+Mono:wght@400;500&display=block',
            css: ['style/themes/pixel-pop/tokens.css', 'style/themes/pixel-pop/pixel-pop.css'],
            images: true,
            swatch: ['#d8e3f8', '#fbe6cf', '#a3d56e', '#2a2421'],
        },
        skyglass: {
            label: 'Skyglass',
            description: 'Bright and airy: frosted glass over a blue sky, glossy bubble buttons. Dark is Deep sea.',
            fonts: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;600;700&display=block',
            css: ['style/themes/skyglass/tokens.css', 'style/themes/skyglass/skyglass.css'],
            images: true,
            swatch: ['#56bdf0', 'rgba(255, 255, 255, .45)', '#1565c0', '#0b2a4a'],
        },
        gildmoor: {
            label: 'Gildmoor',
            description: 'An enchanted book: gilded frames with diamond corners on midnight enamel, jewel buttons. Light is Parchment.',
            // fonts ship with the style (style/themes/gildmoor/fonts), so nothing comes from the internet
            css: ['style/themes/gildmoor/tokens.css', 'style/themes/gildmoor/gildmoor.css'],
            images: true,
            swatch: ['#070a22', '#121546', '#203d83', '#d9b45a'],
        },
        nullsec: {
            label: 'Nullsec',
            description: 'A cyberpunk HUD: neon outlines with cut corners on a dark dot grid, terse capitals. Light is Paper.',
            css: ['style/themes/nullsec/tokens.css', 'style/themes/nullsec/nullsec.css'],
            images: true,
            swatch: ['#07070b', '#0e0d14', '#ff2a3d', '#19e6e6'],
        },
        astrolabe: {
            label: 'Astrolabe',
            description: 'A star atlas meets an observatory: hairline panels over a starfield, buttons like lit planets. Light is Atlas.',
            css: ['style/themes/astrolabe/tokens.css', 'style/themes/astrolabe/astrolabe.css'],
            images: true,
            swatch: ['#05060f', 'rgba(11, 15, 38, .92)', '#2d4fc0', '#e8ecff'],
        },
        reentry: {
            label: 'Reentry',
            description: 'A 90s-anime cockpit: screwed gunmetal plates, chunky cel-shaded keys, amber CRT glow. Light is Hangar.',
            css: ['style/themes/reentry/tokens.css', 'style/themes/reentry/reentry.css'],
            images: true,
            swatch: ['#0b0e13', '#1b2129', '#f29a2e', '#e6e9ee'],
        },
    };

    // the src/ folder, worked out from where this file is (pages live at different depths)
    const appRoot = new URL('../../', document.currentScript?.src || location.href);
    const darkQuery = matchMedia('(prefers-color-scheme: dark)');
    const attr = text => String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

    function read() {
        try {
            return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
        } catch {
            return { ...DEFAULTS };
        }
    }

    function save(changes) {
        const settings = { ...read(), ...changes };
        try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
        apply(settings);
        return settings;
    }

    // the stylesheets a style needs, in order (fonts first)
    function styleHrefs(style) {
        const { fonts, css } = STYLES[style];
        return [...(fonts ? [fonts] : []), ...css.map(path => new URL(path, appRoot).href)];
    }

    function setTheme(settings) {
        const html = document.documentElement;
        const dark = settings.theme === 'dark' || (settings.theme === 'system' && darkQuery.matches);
        html.dataset.theme = dark ? 'dark' : 'light';
        html.style.colorScheme = dark ? 'dark' : 'light'; // the empty page is dark too, before CSS
        const style = STYLES[settings.style] ? settings.style : 'default';
        html.dataset.style = style;
        return style;
    }

    // While the page loads: written into the <head>, so the browser waits for them (no flash).
    function writeInitial(settings) {
        const style = setTheme(settings);
        const hrefs = styleHrefs(style);
        if (STYLES[style].fonts) document.write('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
        for (const href of hrefs) document.write(`<link rel="stylesheet" data-app-style href="${attr(href)}">`);
        document.write(`<style id="custom_css">${(settings.customCss || '').replace(/<\/style/gi, '<\\/style')}</style>`);
    }

    // The picture for a project that has none of its own, in this style and theme.
    // kind: 'thumb' (cards) or 'cover' (wide). The Default style keeps the stock photo.
    const DEFAULT_PHOTO = 'https://images.pexels.com/photos/6325886/pexels-photo-6325886.jpeg';
    function defaultImage(kind = 'thumb') {
        const { style, theme } = document.documentElement.dataset;
        if (!STYLES[style]?.images) return DEFAULT_PHOTO;
        return new URL(`style/themes/${style}/images/project-${kind}-${theme === 'dark' ? 'dark' : 'light'}.svg`, appRoot).href;
    }

    // Later (Settings page, another tab changed them): the new style loads fully, then the old one goes.
    function apply(settings = read()) {
        const style = setTheme(settings);
        const wanted = styleHrefs(style);
        const current = [...document.querySelectorAll('link[data-app-style]')];
        if (current.map(link => link.href).join('|') !== wanted.join('|')) {
            const added = wanted.map(href => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                link.dataset.appStyle = '';
                return link;
            });
            const custom = document.getElementById('custom_css');
            for (const link of added) document.head.insertBefore(link, custom); // your CSS stays last
            Promise.all(added.map(link => new Promise(done => { link.onload = link.onerror = done; })))
                .then(() => current.forEach(link => link.remove()));
            if (!added.length) current.forEach(link => link.remove());
        }
        let custom = document.getElementById('custom_css');
        if (!custom) {
            custom = document.createElement('style');
            custom.id = 'custom_css';
            document.head.append(custom);
        }
        custom.textContent = settings.customCss || '';
        dispatchEvent(new Event('settingschange')); // pages swap in the new style's default pictures
    }

    // System theme follows the device as it changes; other pages pick up changes made in Settings
    darkQuery.addEventListener('change', () => { if (read().theme === 'system') apply(); });
    addEventListener('storage', e => { if (e.key === KEY) apply(); });

    if (document.readyState === 'loading') writeInitial(read());
    else apply();
    return { STYLES, DEFAULT_PHOTO, read, save, apply, defaultImage };
})();
