import streamDeck from "@elgato/streamdeck";

import { monitor } from "./monitor";
import { DEFAULT_BASE_URL, type GlobalSettings, normalizeBaseUrl } from "./settings";

let inflight: Promise<void> | undefined;

/** Reads the server URL from Stream Deck and fills the default the first time. */
export async function syncGlobals(): Promise<void> {
	if (!inflight) {
		inflight = readGlobals().finally(() => {
			inflight = undefined;
		});
	}
	return inflight;
}

export function applyGlobals(settings: GlobalSettings | undefined): void {
	monitor.setGlobals({
		baseUrl: normalizeBaseUrl(settings?.baseUrl),
		token: settings?.token ?? "",
	});
}

async function readGlobals(): Promise<void> {
	const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	applyGlobals(settings);
	if (!settings?.baseUrl) {
		await streamDeck.settings.setGlobalSettings<GlobalSettings>({
			baseUrl: DEFAULT_BASE_URL,
			token: settings?.token ?? "",
		});
	}
}
