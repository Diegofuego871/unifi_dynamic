// Gemeinsame Einstellungen der Panel-Suiten.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Chromium: eigener Pfad über CHROMIUM_PATH, sonst der von
// "npx playwright-core install chromium" installierte Browser.
export const launchOptions = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

// Bildschirmfotos der Suiten (nicht im Repository, siehe .gitignore).
export const outDir = process.env.UDC_TEST_OUT || fileURLToPath(new URL("./output", import.meta.url));
mkdirSync(outDir, { recursive: true });
