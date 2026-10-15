import streamDeck from "@elgato/streamdeck";

import { TapoClient } from "./api";
import { type DeviceState, type GlobalSettings, DEFAULT_BASE_URL, normalizeBaseUrl } from "./settings";

export type Snapshot = {
	online: boolean;
	devices: DeviceState[];
	/** True once, when the controller becomes unreachable, so keys can flash an alert. */
	dropped: boolean;
	/** False until the first poll finishes, so keys don't flash "hors ligne" at startup. */
	known: boolean;
};

type Listener = (snapshot: Snapshot) => void;

const POLL_MS = 3000;

class DeviceMonitor {
	current: Snapshot = { online: false, devices: [], dropped: false, known: false };

	readonly #listeners = new Set<Listener>();
	#timer: ReturnType<typeof setInterval> | undefined;
	#ticking = false;
	#alertedWhileDown = false;
	#globals: GlobalSettings = { baseUrl: DEFAULT_BASE_URL, token: "" };

	watch(listener: Listener): () => void {
		this.#listeners.add(listener);
		this.#ensure();
		listener(this.current);
		return () => {
			this.#listeners.delete(listener);
			if (this.#listeners.size === 0) {
				this.#stop();
			}
		};
	}

	setGlobals(settings: GlobalSettings): void {
		this.#globals = {
			baseUrl: normalizeBaseUrl(settings.baseUrl),
			token: settings.token?.trim() ?? "",
		};
	}

	client(): TapoClient {
		return new TapoClient(this.#globals.baseUrl ?? DEFAULT_BASE_URL, this.#globals.token ?? "");
	}

	/** Applies a local change and redraws keys without waiting for the next poll. */
	mutate(change: (devices: DeviceState[]) => void): void {
		if (!this.current.online) {
			return;
		}
		const devices = this.current.devices.map((device) => ({ ...device }));
		change(devices);
		this.#publish({ online: true, devices, dropped: false, known: true });
	}

	async refresh(): Promise<void> {
		await this.#tick();
	}

	#ensure(): void {
		if (this.#timer) {
			return;
		}
		void this.#tick();
		this.#timer = setInterval(() => {
			void this.#tick();
		}, POLL_MS);
	}

	#stop(): void {
		if (this.#timer) {
			clearInterval(this.#timer);
			this.#timer = undefined;
		}
	}

	async #tick(): Promise<void> {
		if (this.#ticking) {
			return;
		}
		this.#ticking = true;
		try {
			const devices = await this.client().listDevices();
			this.#alertedWhileDown = false;
			this.#publish({ online: true, devices, dropped: false, known: true });
		} catch (error) {
			const dropped = !this.#alertedWhileDown;
			this.#alertedWhileDown = true;
			streamDeck.logger.warn(`Contrôleur Tapo injoignable : ${String(error)}`);
			this.#publish({ online: false, devices: [], dropped, known: true });
		} finally {
			this.#ticking = false;
		}
	}

	#publish(snapshot: Snapshot): void {
		this.current = snapshot;
		for (const listener of this.#listeners) {
			listener(snapshot);
		}
	}
}

export const monitor = new DeviceMonitor();
