// Text out of a document file, for materials you upload that aren't PDFs: Word (.docx), plain text and Markdown.
// A .docx is a zip; its text is in word/document.xml, read with the browser's own unzip (DecompressionStream)
// and XML parser. Nothing in the file is run or shown as HTML. The text becomes the material's readable text.

const Documents = (() => {
    const MAX_CHARS = 2_000_000;
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    const isDocx = file => /\.docx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isText = file => /\.(txt|md|markdown)$/i.test(file.name) || /^text\//.test(file.type);
    const accepts = file => isDocx(file) || isText(file);

    // One file out of a zip, with limits (a small zip can unpack to something huge)
    async function zipEntry(bytes, wanted) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let end = -1; // the zip's table of contents is at its end
        for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
            if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
        }
        if (end < 0) throw new Error("this isn't a Word document");
        const decoder = new TextDecoder();
        let p = view.getUint32(end + 16, true);
        for (let n = view.getUint16(end + 10, true); n > 0; n--) {
            if (p + 46 > bytes.length || view.getUint32(p, true) !== 0x02014b50) throw new Error('this Word document is damaged');
            const method = view.getUint16(p + 10, true);
            const size = view.getUint32(p + 20, true);
            const nameLength = view.getUint16(p + 28, true);
            const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
            if (name === wanted) {
                const local = view.getUint32(p + 42, true);
                const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
                const data = bytes.subarray(start, start + size);
                if (method === 0) return decoder.decode(data);
                if (method !== 8) throw new Error('this Word document uses an unsupported compression');
                const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
                const reader = stream.getReader();
                const chunks = [];
                let total = 0;
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    total += value.length;
                    if (total > MAX_CHARS * 4) {
                        reader.cancel();
                        throw new Error('this Word document is too large');
                    }
                    chunks.push(value);
                }
                return decoder.decode(await new Blob(chunks).arrayBuffer());
            }
            p += 46 + nameLength + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
        }
        throw new Error('this Word document has no text');
    }

    // paragraphs of a .docx, headings as "# …" and list items as "- …" (Markdown, like the rest of the app)
    async function docxText(file) {
        const xml = await zipEntry(new Uint8Array(await file.arrayBuffer()), 'word/document.xml');
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) throw new Error("this Word document's text couldn't be read");
        const lines = [];
        for (const p of doc.getElementsByTagNameNS(W, 'p')) {
            let text = '';
            for (const node of p.getElementsByTagNameNS(W, '*')) {
                if (node.localName === 't') text += node.textContent;
                else if (node.localName === 'tab') text += '\t';
                else if (node.localName === 'br') text += '\n';
            }
            const style = p.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val') || '';
            const level = style.match(/heading\s*(\d)/i)?.[1];
            if (/^title$/i.test(style)) text = '# ' + text;
            else if (level) text = '#'.repeat(Math.min(6, Number(level) + 1)) + ' ' + text;
            else if (p.getElementsByTagNameNS(W, 'numPr').length) text = '- ' + text;
            lines.push(text);
        }
        return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CHARS);
    }

    async function text(file) {
        if (isDocx(file)) return docxText(file);
        return (await file.text()).replace(/\r\n?/g, '\n').slice(0, MAX_CHARS); // Windows line endings too
    }

    return { accepts, isDocx, text };
})();
