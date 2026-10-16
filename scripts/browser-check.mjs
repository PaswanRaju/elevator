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
  const state = await evaluate("(() => { const e = document.querySelector('.experience'); return `stage=${e?.dataset.stage} floor=${e?.dataset.floor} renderer=${e?.dataset.renderer} panel=${e?.dataset.panel}`; })()").catch(() => "unavailable");
  throw new Error(`Condition failed: ${expression}\nState: ${state}`);
}
async function tapPoint(point) {
  if (touch) {
    await command("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await command("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    await command("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
    await command("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
    await command("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
  }
}
// Clicks the first matching control that is actually visible, at its centre, like a real visitor.
async function click(selector) {
  // Software WebGL can drop to a few frames per second, so give the frame loop a moment to place targets.
  for (let attempt = 0; attempt < 40; attempt++) {
    try { return await clickOnce(selector); } catch (error) { if (attempt === 39) throw error; await pause(150); }
  }
}
async function clickOnce(selector) {
  const point = await evaluate(`(() => {
    for (const el of document.querySelectorAll(${JSON.stringify(selector)})) {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      if (!r.width || s.visibility === 'hidden' || s.display === 'none' || el.disabled) continue;
      if (el.closest('[aria-hidden=true]') && !el.classList.contains('hit')) continue;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    throw new Error('No visible control for ${selector.replace(/'/g, "")}: ' + JSON.stringify([...document.querySelectorAll(${JSON.stringify(selector)})].map((el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return [el.className, Math.round(r.left), Math.round(r.top), Math.round(r.width), s.visibility, s.display, el.disabled]; })) + ' panel=' + document.querySelector('.experience').dataset.panel);
  })()`);
  await tapPoint(point);
}
const floorButton = (n) => `.floor-control[data-floor-button="${n}"], .panel-button[data-floor-button="${n}"]`;
async function phase(stage, timeout = 15000) {
  await until(`document.querySelector('.experience')?.dataset.stage === ${JSON.stringify(stage)}`, timeout);
  await pause(150);
}
async function ready(requireWebGL = true) {
  await until("document.querySelector('.experience')?.dataset.ready === 'true'", 30000);
  if (requireWebGL) assert.equal(await evaluate("document.querySelector('.experience').dataset.renderer"), "webgl", "The real 3D renderer must start");
}
async function layout(label) {
  const issues = await evaluate(`(() => {
    const issues = [], w = innerWidth, h = innerHeight;
    const shown = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && !el.closest('[data-visible=false]') ? r : null; };
    if (document.documentElement.scrollWidth > w + 1) issues.push('horizontal overflow');
    for (const el of document.querySelectorAll('button')) {
      const r = shown(el); if (!r) continue;
      if (r.width < 43.5 || r.height < 43.5) issues.push((el.className || el.tagName) + ': target smaller than 44px');
      if (r.left < -1 || r.right > w + 1 || r.top < -1 || r.bottom > h + 1) issues.push((el.getAttribute('aria-label') || el.className) + ': outside viewport');
    }
    // The guide must never cover journey controls, copy or the portrait.
    const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    for (const part of document.querySelectorAll('.guide-bubble, .guide-avatar, .guide-reopen')) {
      const a = shown(part); if (!a) continue;
      for (const el of document.querySelectorAll('.enter-button, .floor-control, .panel-button, .surprise-button, .interact-button, .return-button, .top-controls button, .scene-copy h1, .scene-copy h2, .scene-copy p, .portrait')) {
        const b = shown(el); if (b && hit(a, b)) issues.push(part.className + ' overlaps ' + (el.getAttribute('aria-label') || el.className || el.tagName));
      }
    }
    return issues;
  })()`);
  if (issues.length) console.log(`WARN ${label}: ${issues.join("; ")}`);
  return issues;
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
  const layoutIssues = [];
  const record = async (label) => layoutIssues.push(...(await layout(label)).map((issue) => `${label}: ${issue}`));
  const reduce = (on) => command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: on ? "reduce" : "no-preference" }] });

  // 1. Full-speed cinematic journey on desktop: call, enter, ride to Floor 10, interact, return, ride to Floor 13.
  if (!process.env.QA_LAYOUT_ONLY) {
    await viewport(1440, 900, false);
    await command("Page.navigate", { url: `http://127.0.0.1:${port}` });
    await ready(); await pause(1500); await record("Desktop arrival"); await shot("desktop-arrival");
    assert.match(await evaluate("document.querySelector('.guide-float img').currentSrc"), /avatar\.jpg/, "Guide shows avatar.jpg");
    await click(".sound-button"); await until("document.querySelector('.sound-button').getAttribute('aria-pressed') === 'true'"); await click(".sound-button");
    const started = Date.now();
    await click(".hit-call"); await phase("calling"); await pause(2600); await shot("desktop-calling");
    await phase("entering", 20000); await pause(1800); await shot("desktop-entering");
    await phase("cabin", 20000); await pause(800); await record("Desktop cabin"); await shot("desktop-cabin");
    assert.equal(await evaluate("document.querySelectorAll('.floor-control').length"), 13, "13 physical floor buttons");
    assert.equal(await evaluate("document.querySelectorAll('.panel-button').length"), 13, "13 panel buttons");
    assert.match(await evaluate("document.querySelector('.cabin-copy').textContent"), /Pick a random floor\.\s*Every number hides a different world\./);
    console.log(`INFO desktop panel mode: ${await evaluate("document.querySelector('.experience').dataset.panel")}`);
    await click(floorButton(10)); await phase("ride"); await pause(2600); await shot("desktop-ride");
    await phase("destination", 90000); await pause(3500); await record("Desktop floor 10"); await shot("desktop-floor10");
    assert.ok(Date.now() - started >= 15000, "Normal journey does not skip the cinematic");
    assert.equal(await evaluate("document.querySelector('.destination-copy h1').textContent"), "You Were Not Meant to Find This.");
    assert.match(await evaluate("document.querySelector('.portrait img').currentSrc"), /raju\.png/, "Floor 10 portrait uses raju.png");
    assert.equal(await evaluate("[...document.querySelectorAll('img')].filter((img) => /avatar/.test(img.currentSrc) && img.closest('.portrait, .destination-copy')).length"), 0, "No dollar/avatar image on Floor 10");
    await click(".interact-button"); await until("document.querySelector('.portrait').classList.contains('is-close')"); await pause(1200); await shot("desktop-floor10-closer");
    await click(".return-button"); await phase("returning"); await phase("cabin", 20000);
    await click(floorButton(13)); await phase("destination", 90000); await pause(2500); await shot("desktop-floor13");
    assert.equal(await evaluate("document.querySelector('.destination-copy h1').textContent"), "Digital Dimension");
    await click(".interact-button"); await pause(1500); await shot("desktop-floor13-stabilized");
    await click(".return-button"); await phase("cabin", 20000);
    await click(".wordmark"); await phase("arrival");
    await click(".guide-avatar"); await until("!!document.querySelector('.guide-bubble')");
    await click(".guide-close"); await until("!!document.querySelector('.guide-reopen') && !document.querySelector('.guide-bubble')");
    await click(".guide-reopen"); await until("!!document.querySelector('.guide-avatar') && !!document.querySelector('.guide-bubble')");
    console.log(`PASS full-speed journey (${((Date.now() - started) / 1000).toFixed(0)}s): call, doors, enter, Floor 10 reveal + interaction, return, Floor 13, lobby, guide hide/reopen.`);
  }

  // 2. Every floor: correct world, heading and a working interaction (reduced motion keeps it quick).
  if (!process.env.QA_LAYOUT_ONLY) {
    await reduce(true);
    await viewport(1280, 800, false);
    await command("Page.navigate", { url: `http://127.0.0.1:${port}` });
    await ready(); await click(".enter-button"); await phase("cabin", 20000);
    for (let n = 1; n <= 13; n++) {
      await click(floorButton(n)); await phase("destination", 60000); await pause(1200);
      assert.equal(await evaluate("document.querySelector('.experience').dataset.floor"), String(n));
      const heading = await evaluate("document.querySelector('.destination-copy h1').textContent");
      await click(".interact-button"); await pause(1300); await shot(`floor-${String(n).padStart(2, "0")}`);
      console.log(`PASS floor ${n}: ${heading}`);
      await click(".return-button"); await phase("cabin", 20000);
    }
  }

  // 3. Layout on phones, tablets and desktops.
  await reduce(true);
  const sizes = process.env.QA_SIZES ? process.env.QA_SIZES.split(",").map((size) => size.split("x").map(Number)) : [[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024], [820, 1180], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440], [844, 390], [932, 430]];
  for (const [width, height] of sizes) {
    await viewport(width, height, width < 1100);
    await command("Page.navigate", { url: `http://127.0.0.1:${port}` });
    await ready(); await pause(900); await shot(`${width}x${height}-arrival`); await record(`${width}x${height} arrival`);
    await click(".enter-button"); await phase("cabin", 90000); await pause(700); await shot(`${width}x${height}-cabin`); await record(`${width}x${height} cabin`);
    if (process.env.QA_DEBUG) console.log(await evaluate("JSON.stringify([...document.querySelectorAll('.floor-control')].map((b) => { const r = b.getBoundingClientRect(); return [b.dataset.floorButton, Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2), Math.round(r.width), b.style.visibility]; }))"));
    await click(".surprise-button"); await phase("destination", 120000); await pause(1500); await record(`${width}x${height} destination`);
    await click(".return-button"); await phase("cabin", 90000);
    await click(floorButton(10)); await phase("destination", 120000); await pause(2000); await shot(`${width}x${height}-floor10`); await record(`${width}x${height} floor 10`);
    console.log(`PASS ${width}x${height} (${touch ? "touch" : "mouse"}) panel=${await evaluate("document.querySelector('.experience').dataset.panel")}`);
  }
  assert.deepEqual(errors, [], "No runtime or shader errors");

  // 4. Recovery from a real GPU context loss: the 2D view completes the journey.
  await evaluate("document.querySelector('.world canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()");
  await until("document.querySelector('.experience').dataset.renderer === 'fallback'");
  await click(".return-button"); await phase("cabin", 20000); await click(floorButton(10)); await phase("destination", 60000); await pause(1500);
  assert.match(await evaluate("document.querySelector('.portrait img').currentSrc"), /raju\.png/, "Fallback Floor 10 shows raju.png");
  await shot("fallback-floor10");
  console.log("PASS context-loss fallback completes the journey.");
  if (layoutIssues.length) console.log(`\nLayout warnings (${layoutIssues.length}):\n- ${layoutIssues.join("\n- ")}`);
  else console.log("PASS layout: no overlaps, no undersized or off-screen controls.");
} finally {
  for (const { timeout, reject } of pending.values()) { clearTimeout(timeout); reject(new Error("Browser check ended")); }
  pending.clear(); browser?.kill("SIGTERM"); server?.kill("SIGTERM"); await pause(300);
  rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}
