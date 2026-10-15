import type { DeviceState } from "./settings";

type ColorBody = {
	hue?: number;
	saturation?: number;
	brightness?: number;
};

/**
 * Thin client for the local Tapo L630 controller.
 * Credentials stay in that server; this only speaks its REST API.
 */
export class TapoClient {
	constructor(
		private readonly baseUrl: string,
		private readonly token: string,
	) {}

	async listDevices(): Promise<DeviceState[]> {
		const body = await this.request<{ devices: DeviceState[] }>("GET", "/api/devices");
		return body.devices ?? [];
	}

	async setPower(target: string, on: boolean): Promise<void> {
		await this.request("POST", this.powerPath(target), { on });
	}

	async setColor(target: string, color: ColorBody): Promise<void> {
		await this.request("POST", this.colorPath(target), color);
	}

	async startEffect(target: string, effect: "rainbow" | "police", speed: number): Promise<void> {
		const path =
			target === "all" ? `/api/all/effect/${effect}` : `/api/devices/${encodeURIComponent(target)}/effect/${effect}`;
		await this.request("POST", path, { speed });
	}

	async stopEffects(deviceIds: string[]): Promise<void> {
		await Promise.all(deviceIds.map((id) => this.request("POST", `/api/devices/${encodeURIComponent(id)}/effect/stop`)));
	}

	private powerPath(target: string): string {
		return target === "all" ? "/api/all/power" : `/api/devices/${encodeURIComponent(target)}/power`;
	}

	private colorPath(target: string): string {
		return target === "all" ? "/api/all/color" : `/api/devices/${encodeURIComponent(target)}/color`;
	}

	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const headers: Record<string, string> = {};
		if (body !== undefined) {
			headers["Content-Type"] = "application/json";
		}
		if (this.token) {
			headers.Authorization = `Bearer ${this.token}`;
		}

		const response = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
			signal: AbortSignal.timeout(5000),
		});

		if (!response.ok) {
			throw new Error(await readError(response));
		}

		if (response.status === 204) {
			return undefined as T;
		}

		const text = await response.text();
		if (!text) {
			return undefined as T;
		}
		return JSON.parse(text) as T;
	}
}

async function readError(response: Response): Promise<string> {
	try {
		const data = (await response.json()) as { detail?: unknown };
		if (typeof data.detail === "string") {
			return data.detail;
		}
	} catch {
		// The body was not JSON.
	}
	return `HTTP ${response.status}`;
}
