/** Presets from the Tapo L630 web controller, kept in the same order. */
export const COLORS: { label: string; hex: string }[] = [
	{ label: "White", hex: "#FFFFFF" },
	{ label: "Dark Blue", hex: "#0000AA" },
	{ label: "Dark Green", hex: "#00AA00" },
	{ label: "Dark Aqua", hex: "#00AAAA" },
	{ label: "Dark Red", hex: "#AA0000" },
	{ label: "Dark Purple", hex: "#AA00AA" },
	{ label: "Gold", hex: "#FFAA00" },
	{ label: "Blue", hex: "#5555FF" },
	{ label: "Green", hex: "#55FF55" },
	{ label: "Aqua", hex: "#55FFFF" },
	{ label: "Red", hex: "#FF5555" },
	{ label: "Light Purple", hex: "#FF55FF" },
	{ label: "Yellow", hex: "#FFFF55" },
	{ label: "Minecoin Gold", hex: "#DDD605" },
	{ label: "Redstone", hex: "#971607" },
	{ label: "Copper", hex: "#B4684D" },
	{ label: "Material Gold", hex: "#DEB12D" },
	{ label: "Emerald", hex: "#47A036" },
	{ label: "Diamond", hex: "#2CBAA8" },
	{ label: "Lapis", hex: "#21497B" },
	{ label: "Amethyst", hex: "#9A5CC6" },
	{ label: "Resin", hex: "#EB7114" },
	{ label: "Light Blue", hex: "#8BB3FF" },
];

export type Hsv = {
	hue: number;
	saturation: number;
	brightness: number;
};

/**
 * Converts a #RRGGBB color to the HSV ranges the Tapo controller expects.
 * Saturation and brightness are at least 1, matching the API clamps.
 */
export function hexToHsv(hex: string): Hsv | undefined {
	const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
	if (!match) {
		return undefined;
	}

	const raw = match[1];
	const r = parseInt(raw.slice(0, 2), 16) / 255;
	const g = parseInt(raw.slice(2, 4), 16) / 255;
	const b = parseInt(raw.slice(4, 6), 16) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;

	let hue = 0;
	if (delta !== 0) {
		if (max === r) {
			hue = ((g - b) / delta) % 6;
		} else if (max === g) {
			hue = (b - r) / delta + 2;
		} else {
			hue = (r - g) / delta + 4;
		}
		hue *= 60;
		if (hue < 0) {
			hue += 360;
		}
	}

	const saturation = max === 0 ? 0 : delta / max;
	return {
		hue: Math.round(hue),
		saturation: Math.max(1, Math.min(100, Math.round(saturation * 100))),
		brightness: Math.max(1, Math.min(100, Math.round(max * 100))),
	};
}
