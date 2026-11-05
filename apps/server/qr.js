// A QR code drawn in the terminal (for the server's invite links), with the same QR library the app uses
// (src/vendor/qrcode.js). Each line of text holds two rows of the code (half blocks ▀ ▄ █), in white on black so it
// scans whatever the terminal's colours.

const path = require('path');
const qrcode = require(path.join(__dirname, '..', '..', 'src', 'vendor', 'qrcode.js'));

function terminalQr(text, { color = process.stdout.isTTY } = {}) {
    const qr = qrcode(0, 'L');
    qr.addData(text);
    qr.make();
    const size = qr.getModuleCount();
    const quiet = 2; // the light border scanners need around it
    const dark = (row, col) => row >= 0 && col >= 0 && row < size && col < size && qr.isDark(row, col);
    const lines = [];
    for (let row = -quiet; row < size + quiet; row += 2) {
        let line = '';
        for (let col = -quiet; col < size + quiet; col++) {
            const top = dark(row, col);
            const bottom = dark(row + 1, col);
            // the light parts are drawn (white); the dark ones are left as the black background
            line += top && bottom ? ' ' : top ? '▄' : bottom ? '▀' : '█';
        }
        lines.push(color ? `\x1b[97;40m${line}\x1b[0m` : line);
    }
    return lines.join('\n');
}

module.exports = { terminalQr };
