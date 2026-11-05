// This machine's network addresses, for the server's start-up message and serve.js's settings.

// This machine's addresses other devices can reach it at: [{ ip, name, main }]. `main` is the one it uses to reach
// the internet (found by pointing a UDP socket outwards: nothing is sent), listed first. Left out: 169.254.x.x (an
// adapter no network gave an address), and virtual adapters (WSL, Hyper-V, Docker, VirtualBox, VMware), which
// other devices can't reach.
async function networkAddresses() {
    const main = await new Promise(resolve => {
        const socket = require('dgram').createSocket('udp4');
        const done = ip => { try { socket.close(); } catch { } resolve(ip); };
        socket.on('error', () => done(null));
        try { socket.connect(53, '1.1.1.1', () => done(socket.address().address)); } catch { done(null); }
        setTimeout(() => done(null), 1000);
    });
    const VIRTUAL = /vEthernet|WSL|Hyper-V|Docker|VirtualBox|VMware|vboxnet|br-|veth|virbr/i;
    return Object.entries(require('os').networkInterfaces())
        .flatMap(([name, list]) => (list || []).map(a => ({ ...a, name })))
        .filter(a => a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.') && !VIRTUAL.test(a.name))
        .map(a => ({ ip: a.address, name: /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(a.address) && !/tailscale/i.test(a.name) ? `${a.name} (Tailscale?)` : a.name, main: a.address === main }))
        .sort((a, b) => b.main - a.main);
}

module.exports = { networkAddresses };
