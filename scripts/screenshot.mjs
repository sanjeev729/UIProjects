/**
 * scripts/screenshot.mjs
 *
 * Boots a Chromium headless browser, navigates to the running dev server,
 * waits for fonts + the ruler canvas, then captures several screenshots.
 *
 * Usage:  node scripts/screenshot.mjs
 *   (dev server must be running on http://localhost:4321)
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const URL = process.env.SITE_URL || "http://localhost:4321/";
const OUT = "screenshots";

const VIEWPORT = { width: 1440, height: 900 };

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2, // crisp screenshots
  reducedMotion: "reduce",
});
const page = await ctx.newPage();

// Wipe any previously-persisted calibration so screenshots show the default state
await ctx.addInitScript(() => {
  try { localStorage.removeItem("bor.calibration.v1"); } catch {}
});

// Pipe console errors so we can see if the ruler script blew up
page.on("pageerror", (e) => console.error("[pageerror]", e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.error("[console.error]", msg.text());
});

console.log("→ visiting", URL);
await page.goto(URL, { waitUntil: "networkidle" });

// Wait for fonts to load so screenshots aren't FOUT-y
await page.evaluate(() => document.fonts?.ready);

// Wait for the ruler to mount and draw at least one frame
await page.waitForSelector("#ruler-root canvas", { timeout: 10000 });
await page.waitForTimeout(400); // settle

// 1. Hero (above the fold) — ruler pinned to top edge
await page.screenshot({ path: `${OUT}/01-hero.png` });
console.log("✓ 01-hero.png");

// 2. Full page
await page.screenshot({ path: `${OUT}/02-fullpage.png`, fullPage: true });
console.log("✓ 02-fullpage.png");

// 3. Ruler moved to the right edge (keyboard shortcut "4")
await page.keyboard.press("4");
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/03-ruler-right.png` });
console.log("✓ 03-ruler-right.png");

// 4. Ruler on bottom edge ("2")
await page.keyboard.press("2");
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/04-ruler-bottom.png` });
console.log("✓ 04-ruler-bottom.png");

// 5. Open calibration panel via the on-page CTA (Method 1)
await page.click("#open-ruler-btn");
await page.waitForSelector("#cal-panel", { timeout: 5000 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/05-calibrate-method1.png` });
console.log("✓ 05-calibrate-method1.png");

// 6. Switch to Method 3 (credit card) — scope the click to the modal's tab pill
await page.click('#cal-panel [data-method="3"]');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/06-calibrate-method3.png` });
console.log("✓ 06-calibrate-method3.png");

// 7. Close panel + open the dark tips band in view
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
await page.evaluate(() => {
  document.getElementById("tips")?.scrollIntoView({ behavior: "instant", block: "start" });
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/07-tips-band.png` });
console.log("✓ 07-tips-band.png");

// 8. Mobile viewport
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/08-mobile.png` });
console.log("✓ 08-mobile.png");

await browser.close();
console.log("\nDone. Screenshots in ./" + OUT + "/");
