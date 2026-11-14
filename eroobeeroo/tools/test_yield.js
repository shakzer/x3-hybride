'use strict';
// x3-hybride: shared/yield.js - when Cluster Centre steps aside for the Waze map or a Cluster Themes theme.
// A virtual clock: every check is 1 s after the one before (past the 500 ms read cache).
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yield-'));
const WAZE = process.env.WAZE_STATUS_FILE = path.join(dir, 'status.json');
const THEMES = process.env.CLUSTER_THEMES_FILE = path.join(dir, 'themes.json');
const y = require('../shared/yield');
let now = Date.now();
/** Writes `body` (an object or a raw string) to `file` as if at the virtual time `ageMs` ago, then asks `fn`. */
function ask(fn, file, body, ageMs) {
    now += 1000;
    if (body === null) { try { fs.unlinkSync(file); } catch (e) { /* none */ } } else {
        fs.writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body));
        const m = new Date(now - (ageMs === undefined ? 100 : ageMs));
        fs.utimesSync(file, m, m);
    }
    return fn(now);
}
const waze = (b, age) => ask(y.wazeShowing, WAZE, b, age);
const theme = (b) => ask(y.themeShowing, THEMES, b);

// nothing there: not showing
assert.strictEqual(waze(null), false);
assert.strictEqual(theme(null), false);

// Waze: only "showing", with the map on the cluster, counts
assert.strictEqual(waze({ ev: 'status', state: 'showing', target: 'map', cluster: 1, hud: 0 }), true, 'showing on the cluster');
assert.strictEqual(waze({ state: 'showing', target: 'panel', cluster: 1 }), true, 'the whole panel: also not for the pages');
for (const s of ['idle', 'starting', 'frozen', 'error', 'off', 'unsupported']) assert.strictEqual(waze({ state: s, cluster: 1 }), false, s);
assert.strictEqual(waze({ state: 'showing', cluster: 0 }), false, 'the HUD only: the cluster centre is free');
assert.strictEqual(waze('{"state":"show'), false, 'half-written JSON');
assert.strictEqual(waze({ state: 'showing', cluster: 1 }, 60000), false, 'the service died while showing: the status is old');

// Cluster Themes: a fresh { at }
assert.strictEqual(theme({ at: now + 1000 - 500 }), true);
assert.strictEqual(theme({ at: now + 1000 - 60000 }), false, 'old marker');
assert.strictEqual(theme('nope'), false);

// the theme's centre window: open and fresh, as the panel's rectangle, and as the centre slot's own pixels
const win = (b) => ask(y.themeWindow, THEMES, b);
const slotWin = (b) => ask(y.slotWindow, THEMES, b);
const M = { x: 711, y: 171, w: 498, h: 263 };
assert.strictEqual(win({ at: now + 1000 - 100, window: M, open: false }), null, 'closed: not usable');
assert.deepStrictEqual(win({ at: now + 1000 - 100, window: M, open: true }), M, 'open');
assert.strictEqual(win({ at: now + 1000 - 100, window: null, open: true }), null, 'a theme without a window');
assert.strictEqual(win({ at: now + 1000 - 100, window: { x: 1, y: 2, w: 0, h: 5 }, open: true }), null, 'an empty window');
assert.strictEqual(win({ at: now + 1000 - 100, window: { x: 'a', y: 2, w: 5, h: 5 }, open: true }), null, 'a window that is not numbers');
assert.strictEqual(win({ at: now + 1000 - 60000, window: M, open: true }), null, 'an old marker: the theme went');
assert.deepStrictEqual(slotWin({ at: now + 1000 - 100, window: M, open: true }), { x: 711 - 416, y: 171 - 120, w: 498, h: 263 }, 'the slot is 416,120 in the panel');
assert.strictEqual(slotWin({ at: now + 1000 - 100, window: M, open: false }), null);

// asking for it: window-<app>.json beside themes.json, at most once a second, and gone when withdrawn
const f = path.join(dir, 'window-cluster_centre.json');
const t0 = Date.now() + 10000;
y.requestWindow('cluster_centre', { kind: 'pages', showing: false }, t0);
let j = JSON.parse(fs.readFileSync(f, 'utf8'));
assert(j.kind === 'pages' && j.showing === false && j.t === t0 && j.app === 'cluster_centre', JSON.stringify(j));
y.requestWindow('cluster_centre', { kind: 'pages', showing: true }, t0 + 400);
assert.strictEqual(JSON.parse(fs.readFileSync(f, 'utf8')).showing, false, 'not again within a second');
y.requestWindow('cluster_centre', { kind: 'pages', showing: true }, t0 + 1100);
assert.strictEqual(JSON.parse(fs.readFileSync(f, 'utf8')).showing, true);
assert.strictEqual(y.pagesInWindow(t0 + 1200), true, 'pages showing in the window: Cluster Info steps aside');
y.requestWindow('cluster_centre', { kind: 'pages', showing: false }, t0 + 2200);
assert.strictEqual(y.pagesInWindow(t0 + 2300), false, 'asked for but not drawn yet');
y.requestWindow('cluster_centre', { kind: 'pages', showing: true }, t0 + 3300);
assert.strictEqual(y.pagesInWindow(t0 + 3400 + 5100), false, 'an old file: the app went');
y.withdrawWindow('cluster_centre');
assert(!fs.existsSync(f), 'withdrawn');
y.withdrawWindow('cluster_centre');   // twice: nothing
fs.writeFileSync(path.join(dir, 'window-cluster_info.json'), JSON.stringify({ t: t0 + 20000, kind: 'panel', showing: true }));
assert.strictEqual(y.pagesInWindow(t0 + 20100), false, 'a panel is not pages');
fs.writeFileSync(path.join(dir, 'window-broken.json'), '{"t":');
assert.strictEqual(y.pagesInWindow(t0 + 21000), false, 'half-written: skipped');
// without a folder to ask in (no theme ever ran): nothing is made, nothing throws
const real = y.THEMES_DIR;
assert.strictEqual(real, dir);

try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* older Node */ }
console.log('ok   yield: Waze map, Cluster Themes and its centre window');
