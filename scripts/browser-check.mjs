/** Production QA via Chrome DevTools. No browser test package is required. */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const executable = [process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
].find((path) => path && existsSync(path));
if (!executable) throw new Error("Install Chrome or set CHROME_PATH to its executable.");
if (!existsSync(".next/BUILD_ID")) throw new Error("Run npm run build first.");
const profile = mkdtempSync(join(tmpdir(), "elevator-browser-"));
const port = process.env.QA_PORT || "3107";
const pending = new Map();
const errors = [];
let browser, server, session, sequence = 0, touch = false, pipeBuffer = "", log = "", browserLog = "";
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}\n${browserLog}`)); }, 15000);
    pending.set(id, { resolve, reject, timeout });
    browser.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + "\0");
  });
}
const command = (method, params) => send(method, params, session);
async function evaluate(expression) {
  const reply = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description || reply.exceptionDetails.text);
  return reply.result.value;
}
async function until(expression, timeout = 12000) {
  const deadline = Date.now() + timeout;
  do { if (await evaluate(expression)) return; await pause(80); } while (Date.now() < deadline);
  const state = await evaluate("(() => { const e = document.querySelector('.experience'); return `stage=${e?.dataset.stage} progress=${document.querySelector('.journey-track > div')?.style.transform} status=${document.querySelector('[role=status][aria-live]')?.textContent}`; })()").catch(() => "unavailable");
  throw new Error(`Condition failed: ${expression}\nState: ${state}`);
}
async function click(selector) {
  const point = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Missing control'); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (touch) {
    await command("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await command("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await command("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
    await command("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
  }
}
async function enterKey() {
  await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", windowsVirtualKeyCode: 13 });
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
}
async function phase(stage, timeout = 15000) {
  await until(`document.querySelector('.experience')?.dataset.stage === ${JSON.stringify(stage)}`, timeout);
  await pause(150);
}
async function ready(requireWebGL = true) {
  await until("document.querySelector('.experience')?.dataset.ready === 'true'");
  if (requireWebGL) assert.equal(await evaluate("document.querySelector('.experience').dataset.renderer"), "webgl", "The real 3D renderer must start");
}
async function layout(label) {
  const issues = await evaluate(`(() => {
    const issues = [], w = innerWidth, h = innerHeight;
    if (document.documentElement.scrollWidth > w + 1) issues.push('horizontal overflow');
    for (const el of document.querySelectorAll('button')) {
      const r = el.getBoundingClientRect();
      if (!r.width || getComputedStyle(el).visibility === 'hidden') continue;
      if (r.width < 44 || r.height < 44) issues.push(el.className + ': target smaller than 44px');
      if (r.left < -1 || r.right > w + 1 || r.top < -1 || r.bottom > h + 1) issues.push(el.className + ': outside viewport');
    }
    // The guide must never cover journey controls or scene copy.
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    for (const part of document.querySelectorAll('.guide-bubble, .guide-avatar, .guide-reopen')) {
      const a = part.getBoundingClientRect();
      for (const el of document.querySelectorAll('.enter-button, .floor-control, .replay-button, .top-controls button, .scene-copy h1, .scene-copy h2, .scene-copy p, .ride-copy .eyebrow')) {
        if (el.getBoundingClientRect().width && hit(a, el.getBoundingClientRect())) issues.push(part.className + ' overlaps ' + el.className + el.tagName);
      }
    }
    return issues;
  })()`);
  assert.deepEqual(issues, [], label);
}
async function shot(name) {
  if (!process.argv.includes("--screenshots")) return;
  mkdirSync(".qa", { recursive: true });
  const result = await command("Page.captureScreenshot", { format: "png" });
  writeFileSync(`.qa/${name}.png`, Buffer.from(result.data, "base64"));
}
async function viewport(width, height, mobile) {
  touch = mobile;
  await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await command("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: 1 });
}
try {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port], { stdio: ["ignore", "pipe", "pipe"] });
  server.on("error", (error) => { log += error.message; });
  server.stdout.on("data", (chunk) => { log += chunk; });
  server.stderr.on("data", (chunk) => { log += chunk; });
  let serving = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error(`Preview server could not start:\n${log}`);
    try { serving = (await fetch(`http://127.0.0.1:${port}`)).ok; } catch {}
    if (serving) break;
    await pause(100);
  }
  if (!serving) throw new Error(`Preview server did not become ready:\n${log}`);
  // Software WebGL makes CI deterministic; this does not measure phone GPU speed.
  browser = spawn(executable, ["--headless", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-first-run", "--no-default-browser-check", "--remote-debugging-pipe", `--user-data-dir=${profile}`], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
  browser.on("error", (error) => { browserLog += error.message; });
  browser.stderr.on("data", (chunk) => { browserLog += chunk; });
  browser.stdio[3].on("error", () => {});
  browser.stdio[4].on("data", (chunk) => {
    pipeBuffer += chunk.toString();
    let end;
    while ((end = pipeBuffer.indexOf("\0")) !== -1) {
      const raw = pipeBuffer.slice(0, end); pipeBuffer = pipeBuffer.slice(end + 1);
      if (!raw) continue;
      const message = JSON.parse(raw);
      const waiter = pending.get(message.id);
      if (waiter) {
        clearTimeout(waiter.timeout); pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message)); else waiter.resolve(message.result);
      }
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args.map((arg) => arg.value || arg.description).join(" "));
    }
  });
  const target = await send("Target.createTarget", { url: "about:blank" });
  session = (await send("Target.attachToTarget", { targetId: target.targetId, flatten: true })).sessionId;
  await command("Runtime.enable"); await command("Page.enable");
  // QA_LAYOUT_ONLY=1 skips the slow normal-speed journey while iterating on layout.
  if (!process.env.QA_LAYOUT_ONLY) {
  await viewport(1440, 900, false);
  await command("Page.navigate", { url: `http://127.0.0.1:${port}` });
  await ready(); await until("!!document.querySelector('.guide-bubble')"); await pause(1200); await layout("Desktop arrival"); await shot("desktop-arrival");
  assert.equal(await evaluate("document.querySelector('.sound-button').getAttribute('aria-pressed')"), "false");
  await click(".sound-button");
  await until("document.querySelector('.sound-button').getAttribute('aria-pressed') === 'true'");
  await click(".sound-button");
  const started = Date.now();
  await click(".enter-button"); await phase("entering");
  await click(".pause-button");
  const held = await evaluate("document.querySelector('.journey-track > div').style.transform");
  await pause(600);
  assert.equal(await evaluate("document.querySelector('.journey-track > div').style.transform"), held, "Pausing holds the journey");
  await click(".pause-button");
  await phase("cabin"); await layout("Desktop cabin"); await shot("desktop-cabin");
  assert.equal(await evaluate("document.activeElement?.className"), "floor-control", "Focus reaches the physical floor button");
  await enterKey(); await phase("ride");
  const rideStarted = Date.now();
  await pause(2500); await shot("desktop-ride");
  // Software WebGL can render well below the 10 fps the journey clock assumes, which stretches the ride.
  await phase("reveal", 90000);
  console.log(`INFO 12.4s ride took ${((Date.now() - rideStarted) / 1000).toFixed(1)}s of wall time under software WebGL.`); await pause(2200); await layout("Desktop reveal"); await shot("desktop-reveal");
  assert.ok(Date.now() - started >= 18000, "Normal journey does not skip the cinematic");
  assert.equal(await evaluate("document.activeElement?.className"), "replay-button");
  // Each image belongs in exactly one place: avatar.jpg in the guide, raju.png in the reveal portrait.
  assert.match(await evaluate("document.querySelector('.guide-float img').currentSrc"), /avatar\.jpg/, "Guide shows avatar.jpg");
  const loaded = await evaluate("performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => /raju|avatar/.test(name))");
  assert.ok(loaded.some((name) => /raju\.png/.test(name)), `Reveal portrait loads raju.png (saw ${loaded.join(", ")})`);
  console.log(`PASS images: guide uses avatar.jpg, reveal portrait loaded ${loaded.find((name) => /raju/.test(name))}.`);
  await click(".replay-button"); await phase("arrival");
  await until("document.querySelector('.journey-track > div').style.transform === 'scaleX(0)'");
  console.log("PASS normal-speed 3D journey, pause/resume, sound controls, keyboard selection, focus, replay.");
  await click(".guide-avatar"); await until("!!document.querySelector('.guide-bubble')");
  await click(".guide-close"); await until("!!document.querySelector('.guide-reopen') && !document.querySelector('.guide-bubble')");
  await click(".guide-reopen"); await until("!!document.querySelector('.guide-avatar') && !!document.querySelector('.guide-bubble')");
  console.log("PASS guide tap dialogue, hide and reopen.");
  }

  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  for (const [width, height] of [[320, 568], [390, 844], [430, 932], [768, 1024], [1024, 768], [1920, 1080], [844, 390]]) {
    await viewport(width, height, width < 1100);
    await command("Page.navigate", { url: `http://127.0.0.1:${port}` });
    await ready(); await until("!!document.querySelector('.guide-bubble')"); await pause(600); await shot(`${width}x${height}-arrival`); await layout(`${width}×${height} arrival`);
    await click(".enter-button"); await phase("cabin"); await pause(600); await shot(`${width}x${height}-cabin`); await layout(`${width}×${height} cabin`);
    await click(".floor-control"); await phase("reveal", 60000); await pause(1500); await shot(`${width}x${height}-reveal`); await layout(`${width}×${height} reveal`);
    await click(".replay-button"); await phase("arrival");
    console.log(`PASS ${width}×${height}, ${touch ? "touch" : "mouse"}, reduced motion, three scenes, replay.`);
  }
  assert.deepEqual(errors, [], "No runtime or shader errors");
  // Test recovery from the actual GPU context-loss event, without a test-only app API.
  await evaluate("document.querySelector('.world canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()");
  await until("document.querySelector('.experience').dataset.renderer === 'fallback'");
  await click(".enter-button"); await phase("cabin"); await click(".floor-control"); await phase("reveal", 60000);
  await layout("Context-loss compatibility view");
  assert.match(await evaluate("document.querySelector('.portrait-fallback img').currentSrc"), /raju\.png/, "Fallback reveal shows raju.png");
  console.log("PASS context-loss fallback completes the experience.");
} finally {
  for (const { timeout, reject } of pending.values()) { clearTimeout(timeout); reject(new Error("Browser check ended")); }
  pending.clear(); browser?.kill("SIGTERM"); server?.kill("SIGTERM"); await pause(300);
  rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}
