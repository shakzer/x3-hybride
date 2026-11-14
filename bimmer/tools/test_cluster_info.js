'use strict';
// node tools/test_cluster_info.js: the hand-over with eroobeeroo's Cluster Info / Centre (shared/cluster_info.js), in temp folders.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { ClusterInfo } = require('../shared/cluster_info');

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-test-'));
const dir = path.join(base, 'info'), themes = path.join(base, 'themes');
let now = 1000000;
const log = { info: () => {} };
const ci = new ClusterInfo({ id: 'cluster_themes', name: 'Cluster Themes', dir, themesDir: themes, now: () => now }, log);
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

// no folder yet: nothing wanted, nothing shared
ci.scan();
assert.strictEqual(ci.wantsBattery(), false);
assert.strictEqual(ci.sharedSoc(), null);

// publishing makes the folder and writes Cluster Info's format
ci.publish(64.44);
let j = read('cluster_themes.json');
assert.strictEqual(j.v, 1); assert.strictEqual(j.t, now); assert.strictEqual(j.app, 'Cluster Themes');
assert.deepStrictEqual(j.values, { soc: { pct: 64.4 } });
// at most every 500 ms
now += 100; ci.publish(70); assert.strictEqual(read('cluster_themes.json').values.soc.pct, 64.4);
now += 500; ci.publish(70); assert.strictEqual(read('cluster_themes.json').values.soc.pct, 70);
// our own file is not "another app's"
ci.scan(); assert.strictEqual(ci.sharedSoc(), null);

// another app's charge is believed while fresh (3 s), and ignored when stale or out of range
fs.writeFileSync(path.join(dir, 'edrive_live.json'), JSON.stringify({ v: 1, t: now, app: 'eDrive Live', values: { soc: { pct: 41.5 } } }));
ci.scan(); assert.strictEqual(ci.sharedSoc(), 41.5);
now += 3001; ci.scan(); assert.strictEqual(ci.sharedSoc(), null);
fs.writeFileSync(path.join(dir, 'edrive_live.json'), JSON.stringify({ v: 1, t: now, values: { soc: { pct: 140 } } }));
ci.scan(); assert.strictEqual(ci.sharedSoc(), null);

// what is wanted: Cluster Info's wanted.json and Cluster Centre's wanted-<app>.json
assert.strictEqual(ci.wantsBattery(), false);
fs.writeFileSync(path.join(dir, 'wanted.json'), JSON.stringify({ t: now, power: true, values: ['oil'] }));
ci.scan(); assert.strictEqual(ci.wantsBattery(), false);
fs.writeFileSync(path.join(dir, 'wanted-cluster_centre.json'), JSON.stringify({ t: now, values: ['soc', 'battery'] }));
ci.scan(); assert.strictEqual(ci.wantsBattery(), true);
now += 3001; ci.scan(); assert.strictEqual(ci.wantsBattery(), false);
// a half-written file is skipped, not fatal
fs.writeFileSync(path.join(dir, 'broken.json'), '{"t":');
ci.scan();

// no reading: the file goes
ci.publish(null); assert.ok(!fs.existsSync(path.join(dir, 'cluster_themes.json')));

// presence of a theme
ci.markTheme(true);
assert.strictEqual(JSON.parse(fs.readFileSync(path.join(themes, 'themes.json'), 'utf8')).at, now);
ci.markTheme(false); assert.ok(!fs.existsSync(path.join(themes, 'themes.json')));

// stop() removes our file
now += 1000; ci.publish(50); assert.ok(fs.existsSync(path.join(dir, 'cluster_themes.json')));
ci.stop(); assert.ok(!fs.existsSync(path.join(dir, 'cluster_themes.json')));

console.log('cluster_info: ok');

// ---- the centre window (Cluster Centre / Cluster Info ask, the theme opens it) ----
const WIN = { x: 711, y: 171, w: 498, h: 263 };
ci.markTheme(true, { window: WIN, open: false });
let tj = JSON.parse(fs.readFileSync(path.join(themes, 'themes.json'), 'utf8'));
assert.deepStrictEqual(tj.window, WIN); assert.strictEqual(tj.open, false);
// a change goes out at once, not at the next second
ci.markTheme(true, { window: WIN, open: true });
assert.strictEqual(JSON.parse(fs.readFileSync(path.join(themes, 'themes.json'), 'utf8')).open, true);
// a layout without a window, or a window that is not numbers: no window, never "open"
ci.markTheme(true, { window: null, open: true });
tj = JSON.parse(fs.readFileSync(path.join(themes, 'themes.json'), 'utf8'));
assert.strictEqual(tj.window, null); assert.strictEqual(tj.open, false);
ci.markTheme(true, { window: { x: 1, y: 2, w: 'a', h: 4 }, open: true });
assert.strictEqual(JSON.parse(fs.readFileSync(path.join(themes, 'themes.json'), 'utf8')).window, null);
ci.markTheme(false);

// who asks: window-<app>.json in the themes folder, fresh for 3 s, not our own, half-written ones skipped
ci.scan(); assert.strictEqual(ci.wantsWindow(), false);
fs.mkdirSync(themes, { recursive: true });
fs.writeFileSync(path.join(themes, 'window-cluster_centre.json'), JSON.stringify({ t: now, app: 'cluster_centre', kind: 'pages', showing: false }));
ci.scan(); assert.strictEqual(ci.wantsWindow(), true);
now += 3001; ci.scan(); assert.strictEqual(ci.wantsWindow(), false, 'the app went');
fs.writeFileSync(path.join(themes, 'window-cluster_themes.json'), JSON.stringify({ t: now }));
ci.scan(); assert.strictEqual(ci.wantsWindow(), false, 'our own file does not count');
fs.writeFileSync(path.join(themes, 'window-cluster_info.json'), '{"t":');
ci.scan(); assert.strictEqual(ci.wantsWindow(), false, 'half written');
fs.writeFileSync(path.join(themes, 'window-cluster_info.json'), JSON.stringify({ t: now, app: 'cluster_info', kind: 'panel' }));
ci.scan(); assert.strictEqual(ci.wantsWindow(), true);

// HUD Widgets: where its layout leaves room for the panel
const PANEL = { x: 356, y: 188, w: 324, h: 120 };
ci.markLayout(true, PANEL);
let lj = JSON.parse(fs.readFileSync(path.join(themes, 'hud-layout.json'), 'utf8'));
assert.deepStrictEqual(lj.panel, PANEL); assert.strictEqual(lj.at, now);
ci.markLayout(true, null);
assert.strictEqual(JSON.parse(fs.readFileSync(path.join(themes, 'hud-layout.json'), 'utf8')).panel, null, 'no room: said at once');
ci.markLayout(false); assert.ok(!fs.existsSync(path.join(themes, 'hud-layout.json')));

// the biggest empty rectangle (free_rect.js)
const { freeRect } = require('../shared/free_rect');
const HUD = { x: 120, y: 100, w: 560, h: 280 };
assert.deepStrictEqual(freeRect([], HUD), { x: 120, y: 100, w: 560, h: 280 }, 'empty: all of it');
assert.strictEqual(freeRect([{ x: 0, y: 0, w: 800, h: 480 }], HUD), null, 'covered: none');
// Daily's readouts (top row, battery block) and BMW's own speed (bottom left): the room is right of BMW's speed, between them
const daily = [{ x: 140, y: 148, w: 100, h: 33 }, { x: 508, y: 152, w: 120, h: 27 }, { x: 470, y: 314, w: 200, h: 65 }, { x: 120, y: 235, w: 230, h: 145 }];
const r = freeRect(daily, HUD);
assert(r && r.w >= 300 && r.h >= 100 && r.x >= 350 && r.y >= 181 && r.y + r.h <= 314, JSON.stringify(r));
daily.forEach((d) => assert(!(r.x < d.x + d.w && r.x + r.w > d.x && r.y < d.y + d.h && r.y + r.h > d.y), 'overlaps ' + JSON.stringify(d)));
// too little room: none (a panel any smaller would be unreadable)
assert.strictEqual(freeRect([{ x: 120, y: 100, w: 560, h: 240 }], HUD, {}), null);
// every HUD layout: whatever room is found touches none of its readouts
const lay = path.join(__dirname, '..', 'apps', 'idrive_hud_widgets', 'hud', 'layouts');
fs.readdirSync(lay).filter((f) => /\.json$/.test(f)).forEach((f) => {
    const L = JSON.parse(fs.readFileSync(path.join(lay, f), 'utf8'));
    const used = L.widgets.filter((w) => typeof w.x === 'number').map((w) => ({ x: w.x, y: w.y, w: w.w, h: w.h })).concat([{ x: 120, y: 235, w: 230, h: 145 }]);
    const room = freeRect(used, HUD);
    if (room) used.forEach((d) => assert(!(room.x < d.x + d.w && room.x + room.w > d.x && room.y < d.y + d.h && room.y + room.h > d.y), f + ': room ' + JSON.stringify(room) + ' over ' + JSON.stringify(d)));
    console.log('ok   room for the panel in ' + f + ': ' + (room ? room.w + 'x' + room.h + ' at ' + room.x + ',' + room.y : 'none'));
});
console.log('ok   the centre window and the HUD room hand-overs');

fs.rmSync ? fs.rmSync(base, { recursive: true, force: true }) : null;
