// Builds the family edition (familia/index.html) from the Claude version (mexe-mexe.html):
// same game and screens, but a standalone page whose table is hosted on the player's own
// device and connected through free public relays (net.js), no accounts.
// Run after changing mexe-mexe.html:  node familia/build.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "mexe-mexe.html"), "utf8");
const p2p = fs.readFileSync(path.join(__dirname, "net.js"), "utf8");

const bootAt = src.indexOf("  // ---------- boot ----------");
if (bootAt < 0) throw new Error("boot section not found in mexe-mexe.html");
let body = src.slice(0, bootAt) + p2p;

// The <title> and fonts move into <head>; everything else becomes the body.
const titleMatch = body.match(/<title>.*?<\/title>\n/);
body = body.replace(titleMatch[0], "").replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "");
const fontLinks = body.match(/<link[^>]+>\n/g).join("");
body = body.replace(/<link[^>]+>\n/g, "");

const extraCss = `<style>
/* Standalone page: what the Claude page skeleton used to provide, plus connection status. */
:root { padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; -webkit-tap-highlight-color: transparent; }
img { max-width: 100%; }
[hidden] { display: none !important; }
.netpill { margin: 0; display: inline-flex; align-items: center; gap: 8px; align-self: center; padding: 6px 14px; border-radius: 999px; background: var(--shade); font-size: 14px; font-weight: 700; }
.netpill i { width: 9px; height: 9px; border-radius: 50%; background: var(--muted); flex: none; }
.netpill.ok i { background: var(--ok); }
.netpill.warn { color: var(--bad); }
.netpill.warn i { background: var(--bad); }
.screen > .netpill, .wrap > .netpill { align-self: flex-start; }
.invite { display: flex; flex-direction: column; gap: 10px; }
a.btn { display: block; text-align: center; text-decoration: none; }
.btn.whatsapp { background: #25d366; color: #06301a; border-color: transparent; }
.spinner { width: 34px; height: 34px; border-radius: 50%; border: 3px solid var(--line); border-top-color: var(--gold); animation: spin .9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 3s; } }
</style>
`;

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${titleMatch[0]}<meta name="description" content="Mexe-Mexe com as regras da família, para jogar junto de qualquer lugar.">
<meta name="theme-color" content="#173a2d">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Mexe-Mexe">
<link rel="apple-touch-icon" href="icon.png">
<link rel="icon" href="icon.png">
${fontLinks}<script src="https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js"></script>
${extraCss}</head>
<body>
${body}
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, "index.html"), html);

// App icon (180×180): a playing card with a red diamond on the felt green, drawn pixel by pixel.
function icon(size) {
  const px = Buffer.alloc(size * size * 4);
  const put = (x, y, [r, g, b]) => { const i = (y * size + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; };
  const felt = [23, 58, 45], card = [251, 248, 241], red = [179, 38, 30], gold = [242, 194, 48];
  const cx = size / 2, cy = size / 2, w = size * 0.5, h = size * 0.68, rad = size * 0.06;
  const inCard = (x, y, grow) => {
    const dx = Math.abs(x - cx) - (w / 2 + grow - rad), dy = Math.abs(y - cy) - (h / 2 + grow - rad);
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) <= rad;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let c = felt;
    if (inCard(x, y, 4)) c = gold;
    if (inCard(x, y, 0)) c = card;
    if (Math.abs(x - cx) / (size * 0.16) + Math.abs(y - cy) / (size * 0.23) <= 1) c = red;
    put(x, y, c);
  }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
fs.writeFileSync(path.join(__dirname, "icon.png"), icon(180));
console.log("Built familia/index.html and familia/icon.png");
