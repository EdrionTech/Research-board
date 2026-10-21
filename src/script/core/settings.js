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
    const DEFAULTS = { theme: 'system', style: 'default', customCss: '', palettes: {} };

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

    // ---- colours: each style can be repainted in other colours (Settings: the circles under the styles) ----
    // A choice gives one base colour per family the style is built on (Nullsec: its red and its cyan); the
    // lighter, deeper, glow and on-colour shades are worked out from it for the light and dark versions.
    // 'original' (the first) changes nothing. Kept per style: settings.palettes = { nullsec: 'synthwave', … }.
    // colours as numbers; #abc is #aabbcc
    const hex = c => {
        const h = c.replace('#', '');
        return (h.length === 3 ? [...h].map(x => x + x).join('') : h).slice(0, 6);
    };
    const rgb = c => [0, 2, 4].map(i => parseInt(hex(c).slice(i, i + 2), 16));
    const toHex = parts => '#' + parts.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
    // a mixed with b: t of b (0 = a, 1 = b)
    const mix = (a, b, t) => toHex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
    const alpha = (c, a) => '#' + hex(c) + Math.round(a * 255).toString(16).padStart(2, '0');
    const luminance = c => {
        const [r, g, b] = rgb(c).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a, b) => {
        const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
        return (x + 0.05) / (y + 0.05);
    };
    // c, made darker (on a light background) or lighter (on a dark one) until it reads on bg: text needs 4.5,
    // lines and shapes 3
    function readable(c, bg, min = 4.5) {
        const toward = luminance(bg) > 0.4 ? '#000000' : '#ffffff';
        let out = c;
        for (let i = 0; i < 20 && contrast(out, bg) < min; i++) out = mix(out, toward, 0.08);
        return out;
    }
    // the text colour that reads best on a fill
    const on = (c, dark = '#0b0d12', light = '#ffffff') => (contrast(c, dark) >= contrast(c, light) ? dark : light);
    // a button fill whose text (black-ish or white) reads well: deepened when neither does
    function fill(c, dark = '#0b0d12') {
        let out = c;
        for (let i = 0; i < 20 && Math.max(contrast(out, dark), contrast(out, '#ffffff')) < 4.5; i++) out = mix(out, '#000000', 0.08);
        return out;
    }

    const PALETTES = {
        default: {
            families: ['accent'],
            // the accent is links, buttons and focus: readable on the page (#f4f2ee light, #22201e dark)
            paint: ([c]) => ({ light: { '--accent': readable(fill(c), '#f4f2ee') }, dark: { '--accent': readable(c, '#22201e') } }),
            choices: [
                { id: 'original', label: 'Indigo', colors: ['#3d5afe'] },
                { id: 'teal', label: 'Teal', colors: ['#0f8f7e'] },
                { id: 'emerald', label: 'Emerald', colors: ['#2b8a3e'] },
                { id: 'crimson', label: 'Crimson', colors: ['#d1344b'] },
                { id: 'amber', label: 'Amber', colors: ['#d9770b'] },
                { id: 'violet', label: 'Violet', colors: ['#7048e8'] },
                { id: 'rose', label: 'Rose', colors: ['#d6336c'] },
                { id: 'slate', label: 'Slate', colors: ['#4a6382'] },
            ],
        },
        nullsec: {
            families: ['red', 'cyan'],
            paint: colors => {
                const dark = {}, light = {};
                ['red', 'cyan'].forEach((name, i) => {
                    const c = colors[i];
                    const d = fill(c, '#07070b');
                    Object.assign(dark, { [`--${name}`]: d, [`--${name}-dim`]: mix(c, '#07070b', 0.83), [`--${name}-glow`]: alpha(c, 0.45), [`--${name}-ink`]: readable(mix(c, '#ffffff', 0.15), '#0e0d14'), [`--on-${name}`]: on(d, '#07070b') });
                    // Paper: deep enough to read as lines and text on the pale panels
                    const l = fill(readable(c, '#f5f4f9', 3.2), '#07070b');
                    Object.assign(light, { [`--${name}`]: l, [`--${name}-dim`]: mix(c, '#ffffff', 0.84), [`--${name}-glow`]: alpha(l, 0.18), [`--${name}-ink`]: readable(c, '#f5f4f9'), [`--on-${name}`]: on(l, '#07070b') });
                });
                dark['--glitch-a'] = alpha(colors[1], 0.7);
                dark['--glitch-b'] = alpha(colors[0], 0.7);
                light['--glitch-a'] = alpha(light['--cyan'], 0.5);
                light['--glitch-b'] = alpha(light['--red'], 0.5);
                return { dark, light };
            },
            choices: [
                { id: 'original', label: 'Red & cyan', colors: ['#ff2a3d', '#19e6e6'] },
                { id: 'synthwave', label: 'Synthwave', colors: ['#ff2fd0', '#2fd5ff'] },
                { id: 'toxic', label: 'Toxic', colors: ['#9dff1a', '#b14dff'] },
                { id: 'ember', label: 'Ember', colors: ['#ff6a00', '#ffd23f'] },
                { id: 'ice', label: 'Ice', colors: ['#3d8bff', '#7fffd4'] },
                { id: 'bloodmoon', label: 'Blood moon', colors: ['#ff1f4b', '#ff9a3c'] },
            ],
        },
        astrolabe: {
            families: ['star', 'sun'],
            paint: colors => {
                const dark = {}, light = {};
                ['star', 'sun'].forEach((name, i) => {
                    const c = colors[i];
                    // the planets (buttons): a deep body with readable lettering, in both versions
                    const body = fill(mix(c, '#000000', 0.38), '#05060f');
                    const bodies = { [`--${name}-body-hi`]: mix(c, '#ffffff', 0.12), [`--${name}-body`]: body, [`--${name}-body-lo`]: mix(c, '#000000', 0.75), [`--on-body-${name}`]: on(body, '#05060f') };
                    const d = readable(c, '#0b0f26');
                    Object.assign(dark, { [`--${name}`]: d, [`--on-${name}`]: on(d, '#05060f'), [`--${name}-dim`]: alpha(d, 0.14), [`--${name}-glow`]: alpha(d, 0.45) }, bodies);
                    const l = readable(c, '#fbf8f0');
                    Object.assign(light, { [`--${name}`]: l, [`--on-${name}`]: on(l, '#05060f'), [`--${name}-dim`]: alpha(l, 0.1), [`--${name}-glow`]: alpha(l, 0.2) }, bodies);
                });
                return { dark, light };
            },
            choices: [
                { id: 'original', label: 'Starlight', colors: ['#7aa2ff', '#ffcc6f'] },
                { id: 'aurora', label: 'Aurora', colors: ['#5ee6c4', '#b48cff'] },
                { id: 'nebula', label: 'Nebula', colors: ['#b48cff', '#ff9ad5'] },
                { id: 'mars', label: 'Mars', colors: ['#ff7a5c', '#ffcc6f'] },
                { id: 'polar', label: 'Polar', colors: ['#8fd3ff', '#e6ecff'] },
            ],
        },
        gildmoor: {
            families: ['gold'],
            paint: ([c]) => {
                const bright = mix(c, '#ffffff', 0.45);
                // Parchment: the metal deep enough to show on the paper; labels readable as text
                const gold = readable(c, '#f3e5c6', 3);
                return {
                    dark: { '--gold': c, '--gold-bright': bright, '--gold-deep': mix(c, '#000000', 0.45), '--gold-glow': alpha(c, 0.35), '--label': readable(c, '#121546'), '--title': readable(bright, '#121546'), '--on-gem': bright, '--star': alpha(bright, 0.8), '--star-dim': alpha(c, 0.4) },
                    light: { '--gold': gold, '--gold-bright': mix(gold, '#ffffff', 0.25), '--gold-deep': mix(gold, '#000000', 0.25), '--gold-glow': alpha(gold, 0.2), '--label': readable(c, '#f3e5c6'), '--on-gem': bright, '--star': alpha(gold, 0.22), '--star-dim': alpha(gold, 0.12) },
                };
            },
            choices: [
                { id: 'original', label: 'Gold', colors: ['#d9b45a'] },
                { id: 'silver', label: 'Silver', colors: ['#c3ccd8'] },
                { id: 'rosegold', label: 'Rose gold', colors: ['#e3a38c'] },
                { id: 'bronze', label: 'Bronze', colors: ['#c8873e'] },
                { id: 'verdigris', label: 'Verdigris', colors: ['#8fcfb0'] },
            ],
        },
        reentry: {
            families: ['amber', 'blue'],
            paint: colors => {
                const dark = {}, light = {};
                ['amber', 'blue'].forEach((name, i) => {
                    const c = colors[i];
                    // keycaps: the cap with lettering that reads (a dark one on bright caps)
                    const keys = { [`--${name}-hi`]: mix(c, '#ffffff', 0.45), [`--${name}`]: c, [`--${name}-lo`]: mix(c, '#000000', 0.35), [`--on-${name}`]: on(c, '#160b02') };
                    Object.assign(dark, keys, { [`--${name}-ink`]: readable(mix(c, '#ffffff', 0.2), '#1b2129') });
                    Object.assign(light, keys, { [`--${name}-ink`]: readable(c, '#f2f4f6') });
                });
                // the CRT glow follows the main colour
                Object.assign(dark, { '--phosphor': mix(colors[0], '#ffffff', 0.15), '--phosphor-dim': mix(colors[0], '#000000', 0.2), '--phosphor-glow': alpha(colors[0], 0.5), '--lamp-amber': mix(colors[0], '#ffffff', 0.15) });
                return { dark, light };
            },
            choices: [
                { id: 'original', label: 'Amber & blue', colors: ['#f29a2e', '#2c5fd1'] },
                { id: 'redalert', label: 'Red alert', colors: ['#e2462c', '#2c9fd1'] },
                { id: 'mint', label: 'Mint', colors: ['#2fbf71', '#f2a93b'] },
                { id: 'ultramarine', label: 'Ultramarine', colors: ['#4d7cff', '#f29a2e'] },
                { id: 'violet', label: 'Violet', colors: ['#9a5cf0', '#22b8a8'] },
            ],
        },
        skyglass: {
            families: ['blue', 'aqua', 'orange'],
            paint: colors => {
                const dark = {}, light = {};
                ['blue', 'aqua', 'orange'].forEach((name, i) => {
                    const c = colors[i];
                    // the glossy bubbles keep the colour; their text reads on it
                    const shades = { [`--${name}-light`]: mix(c, '#ffffff', 0.35), [`--${name}-deep`]: mix(c, '#000000', 0.35) };
                    Object.assign(dark, shades, { [`--${name}`]: fill(c, '#0b2a4a') });
                    // on frosted glass in daylight, the colour itself is links and outlines: deep enough to read
                    Object.assign(light, shades, { [`--${name}`]: fill(readable(fill(c, '#0b2a4a'), '#e6f4fc', i === 2 ? 3 : 4.5), '#0b2a4a') });
                });
                dark['--on-orange'] = on(dark['--orange'], '#0b2a4a');
                light['--on-orange'] = on(light['--orange'], '#0b2a4a');
                dark['--on-color'] = light['--on-color'] = on(fill(colors[0], '#0b2a4a'), '#0b2a4a');
                return { dark, light };
            },
            choices: [
                { id: 'original', label: 'Sky', colors: ['#1565c0', '#0a7d88', '#f7a21b'] },
                { id: 'sunset', label: 'Sunset', colors: ['#c2410c', '#d6336c', '#fcc419'] },
                { id: 'forest', label: 'Forest', colors: ['#2b8a3e', '#0b7285', '#f59f00'] },
                { id: 'lavender', label: 'Lavender', colors: ['#6741d9', '#ae3ec9', '#ffa8a8'] },
                { id: 'lagoon', label: 'Lagoon', colors: ['#0c8599', '#12b886', '#ff922b'] },
            ],
        },
        'pixel-pop': {
            families: ['teal', 'orange', 'pink', 'lavender', 'green'],
            paint: colors => {
                const vars = {};
                ['teal', 'orange', 'pink', 'lavender', 'green'].forEach((name, i) => {
                    // candy keys carry dark lettering (--on-candy): light enough for it to read
                    const c = readable(colors[i], '#2a2421');
                    Object.assign(vars, { [`--candy-${name}`]: c, [`--lip-${name}`]: mix(c, '#000000', 0.3), [`--deep-${name}`]: mix(c, '#000000', 0.7) });
                });
                return { dark: vars, light: vars };
            },
            choices: [
                { id: 'original', label: 'Candy', colors: ['#6cc3b9', '#f4a64a', '#f7a8cb', '#b6b2f2', '#a3d56e'] },
                { id: 'ocean', label: 'Ocean', colors: ['#5bc0eb', '#7fdbda', '#9bc1ff', '#b8b5ff', '#6fe3c1'] },
                { id: 'sunset', label: 'Sunset', colors: ['#ff9f68', '#ffcf56', '#ff8fab', '#d4a5ff', '#ffd166'] },
                { id: 'berry', label: 'Berry', colors: ['#e57fb0', '#f5a6c8', '#c792ea', '#a78bfa', '#f28fad'] },
                { id: 'meadow', label: 'Meadow', colors: ['#8cc084', '#f2c14e', '#f78154', '#b5b8ff', '#5fad56'] },
            ],
        },
    };

    // the CSS for a style's chosen colours ('' for its own)
    function paletteCss(settings) {
        const style = STYLES[settings.style] ? settings.style : 'default';
        const palette = PALETTES[style];
        const choice = palette?.choices.find(c => c.id === settings.palettes?.[style]);
        if (!choice || choice.id === 'original') return '';
        const { dark, light } = palette.paint(choice.colors);
        const block = (theme, vars) => `html[data-style="${style}"][data-theme="${theme}"] { ${Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(' ')} }`;
        return block('dark', dark) + '\n' + block('light', light);
    }

    // the src/ folder, worked out from where this file is (pages live at different depths)
    const appRoot = new URL('../../', document.currentScript?.src || location.href);
    const darkQuery = matchMedia('(prefers-color-scheme: dark)');
    const attr = text => String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

    // kept with the rest of the data by the local server when it's running (store.js), else in this browser
    function read() {
        const kept = window.RB_SERVER?.data.settings;
        if (kept) return { ...DEFAULTS, ...kept };
        try {
            return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
        } catch {
            return { ...DEFAULTS };
        }
    }

    function save(changes) {
        const settings = { ...read(), ...changes };
        try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
        if (window.RB_SERVER && typeof Store !== 'undefined') Store.saveSettings(settings); // (store.js loads after this file)
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
        document.write(`<style id="palette_css">${paletteCss(settings)}</style>`);
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

    // The phone's status bar (and on phones the browser's own bar, through theme-color) in the top bar's colour, with
    // light or dark clock and battery to match. Run once the style's stylesheets have loaded.
    function paintSystemBars() {
        if (!document.body) return;
        const see = el => el && getComputedStyle(el).backgroundColor;
        const rgba = color => (color?.match(/[\d.]+/g) || []).map(Number);
        let color = see(document.querySelector('.bar'));
        if (!color || (rgba(color)[3] ?? 1) < .9) color = see(document.body); // see-through bars (Skyglass): the page's colour
        document.documentElement.style.setProperty('--status-bg', color);
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'theme-color';
            document.head.append(meta);
        }
        meta.content = color;
        const [r = 255, g = 255, b = 255] = rgba(color);
        const darkBar = 0.299 * r + 0.587 * g + 0.114 * b < 140;
        // the phone app (Capacitor's SystemBars): LIGHT = dark icons for a light bar, DARK = light icons
        window.Capacitor?.nativePromise?.('SystemBars', 'setStyle', { style: darkBar ? 'DARK' : 'LIGHT', bar: 'StatusBar' }).catch(() => { });
    }
    addEventListener('load', paintSystemBars);

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
            // before the chosen colours and your own CSS, which stay last
            const after = document.getElementById('palette_css') || document.getElementById('custom_css');
            for (const link of added) document.head.insertBefore(link, after);
            Promise.all(added.map(link => new Promise(done => { link.onload = link.onerror = done; })))
                .then(() => { current.forEach(link => link.remove()); paintSystemBars(); });
            if (!added.length) current.forEach(link => link.remove());
        }
        let custom = document.getElementById('custom_css');
        if (!custom) {
            custom = document.createElement('style');
            custom.id = 'custom_css';
            document.head.append(custom);
        }
        custom.textContent = settings.customCss || '';
        let colours = document.getElementById('palette_css');
        if (!colours) {
            colours = document.createElement('style');
            colours.id = 'palette_css';
            document.head.insertBefore(colours, custom);
        }
        colours.textContent = paletteCss(settings);
        requestAnimationFrame(paintSystemBars); // the theme or colours changed (a new style paints when it has loaded)
        dispatchEvent(new Event('settingschange')); // pages swap in the new style's default pictures
    }

    // System theme follows the device as it changes; other pages pick up changes made in Settings
    darkQuery.addEventListener('change', () => { if (read().theme === 'system') apply(); });
    addEventListener('storage', e => { if (e.key === KEY) apply(); });

    if (document.readyState === 'loading') writeInitial(read());
    else apply();
    return { STYLES, PALETTES, DEFAULT_PHOTO, read, save, apply, defaultImage };
})();
