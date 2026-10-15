import streamDeck from "@elgato/streamdeck";

import { CommandAction } from "./actions/command";
import { applyGlobals } from "./globals";
import { monitor } from "./monitor";
import type { GlobalSettings } from "./settings";

streamDeck.logger.setLevel("info");
streamDeck.logger.info("Plugin Tapo prêt");
streamDeck.actions.registerAction(new CommandAction());

streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => {
	applyGlobals(ev.settings);
	void monitor.refresh();
});

streamDeck.connect();
