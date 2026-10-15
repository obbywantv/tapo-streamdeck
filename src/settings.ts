export const DEFAULT_BASE_URL = "http://127.0.0.1:8000";

export type CommandName = "toggle" | "on" | "off" | "color" | "brightness" | "rainbow" | "police" | "stop";

export type CommandSettings = {
	target?: string;
	command?: CommandName;
	preset?: string;
	brightness?: number | string;
	speed?: number | string;
};

export type GlobalSettings = {
	baseUrl?: string;
	token?: string;
};

export type DeviceState = {
	id: string;
	name?: string;
	ip?: string;
	reachable: boolean;
	on?: boolean;
	brightness?: number;
	hue?: number;
	saturation?: number;
	effect_active?: boolean;
};

export const COMMANDS: CommandName[] = ["toggle", "on", "off", "color", "brightness", "rainbow", "police", "stop"];

export function normalizeBaseUrl(value: string | undefined): string {
	const trimmed = (value ?? "").trim().replace(/\/+$/, "");
	return trimmed || DEFAULT_BASE_URL;
}

export function asCommand(value: string | undefined): CommandName {
	return COMMANDS.includes(value as CommandName) ? (value as CommandName) : "toggle";
}

export function asNumber(value: number | string | undefined, fallback: number): number {
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}
