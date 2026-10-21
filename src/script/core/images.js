// Pictures for projects and materials: a link, or an image you upload. Uploads are scaled down and kept with
// your data (store.js) and referred to as 'asset:<id>', so backups and deleting take care of them.
// Images.url(ref) gives a URL to show either kind; Images.field(root) runs the picker in a form
// (markup: Images.fieldHtml(label, placeholder)).

const Images = (() => {
    const urls = new Map(); // 'asset:…' -> promise of an object URL
    const MAX = 1200;       // longest side of an uploaded picture, in pixels

    const isStored = ref => /^asset:[a-z0-9]+$/.test(ref || '');

    // a URL to show a picture by ('' when there's none, or its stored file is gone)
    function url(ref) {
        if (!ref) return Promise.resolve('');
        if (!isStored(ref)) return Promise.resolve(ref);
        if (!urls.has(ref)) urls.set(ref, Store.getAsset(ref.slice(6)).then(b => (b ? URL.createObjectURL(b) : '')).catch(() => ''));
        return urls.get(ref);
    }

    // a photo straight off a phone can be several MB: kept at most MAX pixels on its longest side
    async function shrink(file) {
        if (/svg|gif/.test(file.type)) return file; // drawings and animations stay as they are
        try {
            const bitmap = await createImageBitmap(file);
            const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
            if (scale === 1 && file.size < 400e3) return file;
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(bitmap.width * scale);
            canvas.height = Math.round(bitmap.height * scale);
            canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'; // PNGs keep their transparency
            const blob = await new Promise(done => canvas.toBlob(done, type, 0.86));
            if (!blob) return file;
            return scale < 1 || blob.size < file.size ? blob : file; // smaller: kept even if the file isn't
        } catch {
            return file;
        }
    }

    let fields = 0;
    function fieldHtml(label, placeholder) {
        const id = 'image_field_' + ++fields;
        return `
        <div class="image_field">
            <label class="image_field_label" for="${id}">${label}</label>
            <div class="image_field_row">
                <img class="image_field_preview" alt="" hidden>
                <input class="image_field_link" id="${id}" type="url" placeholder="${placeholder}">
                <label class="btn small image_field_upload">Upload image
                    <input type="file" accept="image/*" hidden>
                </label>
                <button type="button" class="link image_field_clear" hidden>Remove</button>
            </div>
            <small class="image_field_note" hidden></small>
        </div>`;
    }

    // The picker inside `root` (.image_field). set(value) when the form opens; value is what to save;
    // commit() after saving (drops the stored picture it replaced), discard() when the form is cancelled.
    function field(root) {
        const link = root.querySelector('.image_field_link');
        const file = root.querySelector('input[type="file"]');
        const preview = root.querySelector('.image_field_preview');
        const clear = root.querySelector('.image_field_clear');
        const note = root.querySelector('.image_field_note');
        const placeholder = link.placeholder;
        let value = '';
        let saved = '';     // the value when the form opened
        let uploads = [];   // pictures uploaded while it's open
        let session = 0;    // a new one each time the form opens or is cancelled (an upload can finish later)

        function show() {
            const stored = isStored(value);
            link.value = stored ? '' : value;
            link.placeholder = stored ? 'Uploaded image · or paste a link' : placeholder;
            clear.hidden = !value;
            const shown = value;
            url(value).then(src => {
                if (shown !== value) return;
                preview.hidden = !src;
                if (src) preview.src = src;
                else preview.removeAttribute('src');
            });
        }

        link.addEventListener('input', () => {
            value = link.value.trim();
            note.hidden = true;
            show();
        });
        preview.addEventListener('error', () => { preview.hidden = true; });
        clear.addEventListener('click', () => {
            value = '';
            show();
        });
        file.addEventListener('change', async () => {
            const picked = file.files[0];
            file.value = '';
            if (!picked) return;
            if (!picked.type.startsWith('image/')) {
                note.textContent = 'That isn\'t an image.';
                note.hidden = false;
                return;
            }
            note.textContent = 'Adding the image…';
            note.hidden = false;
            const started = session;
            try {
                const id = await Store.putAsset(await shrink(picked));
                if (started !== session) return Store.deleteAsset(id); // the form was closed meanwhile
                uploads.push('asset:' + id);
                value = 'asset:' + id;
                note.textContent = picked.name;
                show();
            } catch {
                note.textContent = 'Couldn\'t keep the image (is Research Board still running?).';
            }
        });

        // stored pictures no longer used (refs not equal to `keep`)
        const drop = (refs, keep) => { for (const ref of refs) if (isStored(ref) && ref !== keep) Store.deleteAsset(ref.slice(6)); };

        return {
            get value() { return value; },
            set(v) {
                session++;
                drop(uploads, null);
                uploads = [];
                value = saved = v || '';
                note.hidden = true;
                show();
            },
            commit() {
                drop([...uploads, saved], value);
                uploads = [];
                saved = value;
            },
            discard() {
                session++;
                drop(uploads, saved);
                uploads = [];
            },
        };
    }

    return { url, isStored, field, fieldHtml };
})();
