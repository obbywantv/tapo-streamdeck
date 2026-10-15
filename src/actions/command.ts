import streamDeck, {
	action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { hexToHsv } from "../colors";
import { monitor, type Snapshot } from "../monitor";
import type { DataSourcePayload, DataSourceResult } from "../sdpi";
import { syncGlobals } from "../globals";
import {
	asCommand,
	asNumber,
	type CommandName,
	type CommandSettings,
	type DeviceState,
} from "../settings";

/**
 * One key, one command. The property inspector picks the bulb and the action.
 */
@action({ UUID: "com.pokameni.tapo.command" })
export class CommandAction extends SingletonAction<CommandSettings> {
	readonly #settings = new Map<string, CommandSettings>();
	readonly #stops = new Map<string, () => void>();

	override async onWillAppear(ev: WillAppearEvent<CommandSettings>): Promise<void> {
		const settings = await this.#withDefaults(ev.action, ev.payload.settings);
		this.#settings.set(ev.action.id, settings);
		await syncGlobals();

		const stop = monitor.watch((snapshot) => {
			const current = this.#settings.get(ev.action.id) ?? settings;
			void this.#render(ev.action, current, snapshot);
		});
		this.#stops.set(ev.action.id, stop);
	}

	override onWillDisappear(ev: WillDisappearEvent<CommandSettings>): void {
		this.#stops.get(ev.action.id)?.();
		this.#stops.delete(ev.action.id);
		this.#settings.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<CommandSettings>): Promise<void> {
		this.#settings.set(ev.action.id, ev.payload.settings);
		await this.#render(ev.action, ev.payload.settings, monitor.current);
	}

	override async onKeyDown(ev: KeyDownEvent<CommandSettings>): Promise<void> {
		const settings = ev.payload.settings;
		this.#settings.set(ev.action.id, settings);
		try {
			await syncGlobals();
			await this.#run(settings.target || "all", asCommand(settings.command), settings);
		} catch (error) {
			streamDeck.logger.error(`Commande Tapo échouée : ${String(error)}`);
			await ev.action.showAlert();
		}
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, CommandSettings>): Promise<void> {
		if (!isDeviceRequest(ev.payload)) {
			return;
		}

		let items: DataSourceResult;
		try {
			await syncGlobals();
			const devices = monitor.current.online ? monitor.current.devices : await monitor.client().listDevices();
			items = [
				{ value: "all", label: "Toutes" },
				...devices.map((device) => ({
					value: device.id,
					label: device.name || device.id,
				})),
			];
		} catch (error) {
			streamDeck.logger.warn(`Liste des ampoules indisponible : ${String(error)}`);
			items = [
				{ value: "all", label: "Toutes" },
				{ value: "offline", label: "Serveur injoignable", disabled: true },
			];
		}

		await streamDeck.ui.sendToPropertyInspector({
			event: "getDevices",
			items,
		} satisfies DataSourcePayload);
	}

	async #run(target: string, command: CommandName, settings: CommandSettings): Promise<void> {
		if (!monitor.current.online) {
			await monitor.refresh();
		}
		const client = monitor.client();

		if (command === "on" || command === "off" || command === "toggle") {
			const on = command === "toggle" ? !this.#isOn(target) : command === "on";
			await client.setPower(target, on);
			this.#afterSuccess(markPower(target, on));
			return;
		}

		if (command === "color") {
			const hsv = hexToHsv(normalizeHex(settings.preset) || "#FFFFFF");
			if (!hsv) {
				throw new Error(`Couleur invalide : ${settings.preset ?? ""}`);
			}
			const brightness = clamp(Math.round(asNumber(settings.brightness, 80)), 1, 100);
			await client.setColor(target, {
				hue: hsv.hue,
				saturation: hsv.saturation,
				brightness,
			});
			this.#afterSuccess(markFields(target, { brightness, effect_active: false }));
			return;
		}

		if (command === "brightness") {
			const brightness = clamp(Math.round(asNumber(settings.brightness, 80)), 1, 100);
			await client.setColor(target, { brightness });
			this.#afterSuccess(markFields(target, { brightness, effect_active: false }));
			return;
		}

		if (command === "rainbow" || command === "police") {
			const speed = clamp(asNumber(settings.speed, 1), 0.2, 3);
			await client.startEffect(target, command, speed);
			this.#afterSuccess(markPower(target, true, { effect_active: true }));
			return;
		}

		if (target === "all" && monitor.current.devices.length === 0) {
			await monitor.refresh();
		}
		const ids = this.#deviceIds(target);
		if (ids.length === 0) {
			throw new Error("Aucune ampoule à arrêter");
		}
		await client.stopEffects(ids);
		this.#afterSuccess(markEffect(target, false));
	}

	#afterSuccess(change: (devices: DeviceState[]) => void): void {
		if (monitor.current.online) {
			monitor.mutate(change);
		}
		void monitor.refresh();
	}

	/** Toutes est allumée dès qu'une ampoule joignable est allumée. */
	#isOn(target: string): boolean {
		const devices = this.#matching(target);
		return devices.some((device) => device.reachable && device.on);
	}

	#deviceIds(target: string): string[] {
		if (target !== "all") {
			return [target];
		}
		return monitor.current.devices.map((device) => device.id);
	}

	#matching(target: string): DeviceState[] {
		if (target === "all") {
			return monitor.current.devices;
		}
		return monitor.current.devices.filter((device) => device.id === target);
	}

	async #withDefaults(
		action: WillAppearEvent<CommandSettings>["action"],
		settings: CommandSettings,
	): Promise<CommandSettings> {
		const next: CommandSettings = {
			target: settings.target || "all",
			command: asCommand(settings.command),
			preset: normalizeHex(settings.preset) || "#FFFFFF",
			brightness: asNumber(settings.brightness, 80),
			speed: asNumber(settings.speed, 1),
		};
		const missing =
			!settings.target ||
			!settings.command ||
			!normalizeHex(settings.preset) ||
			settings.brightness === undefined ||
			settings.speed === undefined;
		if (missing) {
			await action.setSettings(next);
		}
		return next;
	}

	async #render(
		action: WillAppearEvent<CommandSettings>["action"],
		settings: CommandSettings,
		snapshot: Snapshot,
	): Promise<void> {
		if (!action.isKey()) {
			return;
		}

		try {
			if (!snapshot.known) {
				await action.setTitle("…");
				return;
			}
			if (!snapshot.online) {
				await action.setTitle("Serveur\nhors ligne");
				await action.setState(0);
				if (snapshot.dropped) {
					await action.showAlert();
				}
				return;
			}

			const target = settings.target || "all";
			if (target === "all") {
				await this.#renderGroup(action, snapshot);
				return;
			}

			const device = snapshot.devices.find((item) => item.id === target);
			const name = device?.name || target;
			if (!device?.reachable) {
				await action.setTitle(`${name}\nHors ligne`);
				await action.setState(0);
				return;
			}

			await action.setState(device.on ? 1 : 0);
			await action.setTitle(`${name}\n${deviceStatus(device)}`);
		} catch (error) {
			streamDeck.logger.debug(`Rendu de touche ignoré : ${String(error)}`);
		}
	}

	async #renderGroup(action: WillAppearEvent<CommandSettings>["action"], snapshot: Snapshot): Promise<void> {
		if (!action.isKey()) {
			return;
		}
		const reachable = snapshot.devices.filter((device) => device.reachable);
		const anyOn = reachable.some((device) => device.on);
		const anyEffect = snapshot.devices.some((device) => device.effect_active);
		await action.setState(anyOn ? 1 : 0);
		if (reachable.length === 0) {
			await action.setTitle("Toutes\nHors ligne");
			return;
		}
		const status = anyEffect ? "Effet" : anyOn ? "Allumé" : "Éteint";
		await action.setTitle(`Toutes\n${status}`);
	}
}

function markFields(target: string, extra: Partial<DeviceState>): (devices: DeviceState[]) => void {
	return (devices) => {
		for (const device of devices) {
			if (target !== "all" && device.id !== target) {
				continue;
			}
			Object.assign(device, extra);
		}
	};
}

function markEffect(target: string, active: boolean): (devices: DeviceState[]) => void {
	return (devices) => {
		for (const device of devices) {
			if (target !== "all" && device.id !== target) {
				continue;
			}
			device.effect_active = active;
		}
	};
}

function markPower(target: string, on: boolean, extra: Partial<DeviceState> = {}): (devices: DeviceState[]) => void {
	return (devices) => {
		for (const device of devices) {
			if (target !== "all" && device.id !== target) {
				continue;
			}
			device.reachable = true;
			device.on = on;
			if (!on) {
				device.effect_active = false;
			}
			Object.assign(device, extra);
		}
	};
}

function deviceStatus(device: DeviceState): string {
	if (device.effect_active) {
		return "Effet";
	}
	if (!device.on) {
		return "Éteint";
	}
	return typeof device.brightness === "number" ? `${device.brightness}%` : "Allumé";
}

function normalizeHex(value: string | undefined): string {
	if (!value || value === "custom") {
		return "";
	}
	const raw = value.trim();
	const hex = raw.startsWith("#") ? raw : `#${raw}`;
	return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toUpperCase() : "";
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function isDeviceRequest(payload: unknown): boolean {
	return typeof payload === "object" && payload !== null && "event" in payload && payload.event === "getDevices";
}
