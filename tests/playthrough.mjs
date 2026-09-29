// Automated end-to-end playthrough (Playwright + Chromium).
// Usage: node tests/playthrough.mjs   (needs `npm i -D playwright` or a global install)
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shots = process.env.SHOTS_DIR || path.join(root, "docs", "screenshots");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("file://" + path.join(root, "index.html"));
await page.waitForTimeout(400);
await page.screenshot({ path: `${shots}/01-start-menu.png` });

const snap = () => page.evaluate(() => window.MQ.snapshot());
const idle = () => page.waitForFunction(() => window.MQ.idle() || window.MQ.state !== "playing", null, { timeout: 15000 });
async function go(x, y) {
  const ok = await page.evaluate(([x, y]) => window.MQ.goto(x, y), [x, y]);
  if (!ok) throw new Error(`no path to ${x},${y}: ${JSON.stringify(await snap())}`);
  await idle();
}
const assert = (c, m) => { if (!c) throw new Error("ASSERT: " + m); console.log("  ✓", m); };

await page.click("#btn-play");
await page.waitForTimeout(200);

// Zone A: gems + key
for (const [x, y] of [[5, 1], [1, 5], [6, 6]]) await go(x, y);
let s = await snap();
assert(s.hasKeyCount === 1, "picked up the key");
await page.screenshot({ path: `${shots}/02-gameplay-key.png` });

// Puzzle 1: locked door
await go(7, 3);
s = await snap();
assert(s.player.x === 7 && s.hasKeyCount === 0, "door unlocked with key and walked through");

// Zone B gems, then Puzzle 2: lever
for (const [x, y] of [[10, 3], [15, 3], [18, 1], [9, 6], [16, 6]]) await go(x, y);
await go(16, 5); // clicking the lever pathfinds next to it and pulls it
s = await snap();
assert(s.gateOpen, "lever opened the orange gate");

// through the gate to the checkpoint
await go(18, 8);
await page.screenshot({ path: `${shots}/03-gameplay-spikes.png` });

// Obstacle 3: timed spike corridor, walk left one tile at a time
for (let x = 17; x >= 1; x--) {
  await page.waitForFunction((nx) => {
    const now = performance.now();
    return [0, 150, 300].every((d) => window.MQ.spikeState(nx, now + d) === "down");
  }, x, { timeout: 5000 });
  await go(x, 8);
}
s = await snap();
assert(s.hearts === 3, "crossed spike corridor unharmed");
await go(1, 10);
await go(2, 10);

// Puzzle 4: crate onto pressure plate
await go(4, 11);
for (let i = 0; i < 5; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(220); }
s = await snap();
assert(s.plateActive && s.crate.locked, "crate locked onto plate, teal gate open");
await page.screenshot({ path: `${shots}/04-gameplay-crate.png` });

// Zone E gems then exit
for (const [x, y] of [[1, 13], [14, 13], [19, 12], [19, 13]]) await go(x, y);
s = await snap();
assert(s.gems === s.gemsTotal, `collected all ${s.gemsTotal} gems`);

// pause menu check
await page.click("#btn-pause");
assert((await page.evaluate(() => window.MQ.state)) === "paused", "pause button works");
await page.screenshot({ path: `${shots}/05-pause.png` });
await page.click("#btn-resume");

await go(19, 11);
assert((await page.evaluate(() => window.MQ.state)) === "won", "reached the exit -> win screen");
await page.waitForTimeout(400);
await page.screenshot({ path: `${shots}/06-win.png` });

await page.click("#btn-win-again");
assert((await page.evaluate(() => window.MQ.state)) === "playing", "play again restarts the level");
assert(errors.length === 0, "no runtime errors: " + errors.join("; "));
await browser.close();
console.log("PLAYTHROUGH PASSED");
