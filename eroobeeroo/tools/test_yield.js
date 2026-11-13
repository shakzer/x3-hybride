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

try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* older Node */ }
console.log('ok   yield: Waze map and Cluster Themes');
