// Your own images in Markdown text (screenshots, photos of handwritten pages…):
// paste or drop them into a text box, or pick a file. Each image is saved in the browser
// (Store assets) and written into the text as ![name](asset:ID); markdown.js shows it.

const MdImages = (() => {
    const isImage = file => file.type.startsWith('image/');

    async function insert(textarea, files) {
        for (const file of [...files].filter(isImage)) {
            let id;
            try {
                id = await Store.putAsset(file);
            } catch {
                alert("Couldn't save the image in this browser (private window or storage full?).");
                return;
            }
            const name = (file.name || 'image').replace(/[[\]]/g, '');
            const { selectionStart: start, selectionEnd: end, value } = textarea;
            const newline = start > 0 && value[start - 1] !== '\n' ? '\n' : '';
            textarea.setRangeText(`${newline}![${name}](asset:${id})\n`, start, end, 'end');
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    // paste (e.g. a screenshot) or drop image files into the text box
    function enable(textarea) {
        textarea.addEventListener('paste', e => {
            const files = [...(e.clipboardData?.files || [])];
            if (!files.some(isImage)) return;
            e.preventDefault();
            insert(textarea, files);
        });
        textarea.addEventListener('dragover', e => {
            if (![...e.dataTransfer.items].some(item => item.kind === 'file')) return;
            e.preventDefault();
            textarea.classList.add('dropping');
        });
        textarea.addEventListener('dragleave', () => textarea.classList.remove('dropping'));
        textarea.addEventListener('drop', e => {
            textarea.classList.remove('dropping');
            if (!e.dataTransfer.files.length) return;
            e.preventDefault();
            insert(textarea, e.dataTransfer.files);
        });
    }

    // choose image files from the computer
    function pick(textarea) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.onchange = () => insert(textarea, input.files).then(() => textarea.focus());
        input.click();
    }

    return { enable, pick };
})();
