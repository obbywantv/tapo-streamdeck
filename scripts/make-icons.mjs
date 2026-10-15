import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "com.pokameni.tapo.sdPlugin", "imgs");

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
	let c = n;
	for (let k = 0; k < 8; k++) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}
	crcTable[n] = c >>> 0;
}

function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) {
		c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const body = Buffer.concat([Buffer.from(type), data]);
	const out = Buffer.alloc(12 + data.length);
	out.writeUInt32BE(data.length, 0);
	body.copy(out, 4);
	out.writeUInt32BE(crc32(body), 8 + data.length);
	return out;
}

function png(width, height, rgba) {
	const raw = Buffer.alloc((width * 4 + 1) * height);
	for (let y = 0; y < height; y++) {
		const row = y * (width * 4 + 1);
		raw[row] = 0;
		rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

function canvas(size) {
	return Buffer.alloc(size * size * 4);
}

function set(px, size, x, y, r, g, b, a) {
	if (x < 0 || y < 0 || x >= size || y >= size) return;
	const i = (y * size + x) * 4;
	const src = a / 255;
	const dst = px[i + 3] / 255;
	const out = src + dst * (1 - src);
	if (out <= 0) return;
	px[i] = Math.round((r * src + px[i] * dst * (1 - src)) / out);
	px[i + 1] = Math.round((g * src + px[i + 1] * dst * (1 - src)) / out);
	px[i + 2] = Math.round((b * src + px[i + 2] * dst * (1 - src)) / out);
	px[i + 3] = Math.round(out * 255);
}

function fillEllipse(px, size, cx, cy, rx, ry, color) {
	const [r, g, b, a] = color;
	const y0 = Math.max(0, Math.floor(cy - ry - 1));
	const y1 = Math.min(size - 1, Math.ceil(cy + ry + 1));
	const x0 = Math.max(0, Math.floor(cx - rx - 1));
	const x1 = Math.min(size - 1, Math.ceil(cx + rx + 1));
	for (let y = y0; y <= y1; y++) {
		for (let x = x0; x <= x1; x++) {
			const dx = (x + 0.5 - cx) / rx;
			const dy = (y + 0.5 - cy) / ry;
			const d = dx * dx + dy * dy;
			if (d <= 1) {
				const edge = d > 0.92 ? Math.max(0, (1 - d) / 0.08) : 1;
				set(px, size, x, y, r, g, b, Math.round(a * edge));
			}
		}
	}
}

function fillRoundRect(px, size, x, y, w, h, radius, color) {
	const [r, g, b, a] = color;
	for (let yy = Math.floor(y); yy < y + h; yy++) {
		for (let xx = Math.floor(x); xx < x + w; xx++) {
			const cx = clamp(xx + 0.5, x + radius, x + w - radius);
			const cy = clamp(yy + 0.5, y + radius, y + h - radius);
			const dx = xx + 0.5 - cx;
			const dy = yy + 0.5 - cy;
			if (dx * dx + dy * dy <= radius * radius) {
				set(px, size, xx, yy, r, g, b, a);
			}
		}
	}
}

function clamp(v, min, max) {
	return Math.min(max, Math.max(min, v));
}

function drawBulb(size, on, plate) {
	const px = canvas(size);
	const s = size / 144;
	if (plate) {
		fillRoundRect(px, size, 6 * s, 6 * s, 132 * s, 132 * s, 28 * s, [32, 28, 48, 255]);
	}
	const glass = on ? [255, 196, 64, 255] : [88, 90, 104, 255];
	const glow = on ? [255, 230, 140, 255] : [120, 122, 136, 255];
	fillEllipse(px, size, 72 * s, 58 * s, 34 * s, 40 * s, glass);
	fillEllipse(px, size, 60 * s, 46 * s, 10 * s, 14 * s, glow);
	fillRoundRect(px, size, 58 * s, 90 * s, 28 * s, 14 * s, 3 * s, on ? [90, 70, 30, 255] : [58, 60, 70, 255]);
	const metal = on ? [210, 176, 96, 255] : [150, 152, 164, 255];
	fillRoundRect(px, size, 54 * s, 104 * s, 36 * s, 22 * s, 4 * s, metal);
	fillRoundRect(px, size, 58 * s, 110 * s, 28 * s, 2 * s, 1 * s, [40, 36, 28, 180]);
	fillRoundRect(px, size, 58 * s, 116 * s, 28 * s, 2 * s, 1 * s, [40, 36, 28, 180]);
	return png(size, size, px);
}

function write(relative, buffer) {
	const file = path.join(root, relative);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, buffer);
}

const files = [
	["plugin/category-icon.png", 72, true, true],
	["plugin/category-icon@2x.png", 144, true, true],
	["plugin/marketplace.png", 256, true, true],
	["plugin/marketplace@2x.png", 512, true, true],
	["actions/command/icon.png", 72, true, true],
	["actions/command/icon@2x.png", 144, true, true],
	["actions/command/off.png", 72, false, false],
	["actions/command/off@2x.png", 144, false, false],
	["actions/command/on.png", 72, true, false],
	["actions/command/on@2x.png", 144, true, false],
];

for (const [relative, size, on, plate] of files) {
	write(relative, drawBulb(size, on, plate));
}

console.log(`Wrote ${files.length} icons`);
