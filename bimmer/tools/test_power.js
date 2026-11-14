'use strict';
// node tools/test_power.js: the energy flow (the battery's power in kW, shared by eDrive Live) that the Sport theme shows in place of the boost:
// the hand-over in shared/cluster_info.js (in temp folders) and the wiring in the layout, the settings and hud.js.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { ClusterInfo } = require('../shared/cluster_info');

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-test-'));
const dir = path.join(base, 'info'), themes = path.join(base, 'themes');
let now = 5000000;
let changes = 0;
const log = { info: () => {} };
const ci = new ClusterInfo({ id: 'cluster_themes', name: 'Cluster Themes', dir, themesDir: themes, now: () => now, onChange: () => { changes++; } }, log);
const share = (f, obj) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, f), JSON.stringify(obj)); };

// nobody shares: no power, no change
ci.scan(); assert.strictEqual(ci.sharedPower(), null); assert.strictEqual(changes, 0);

// eDrive Live shares: the power is read (negative = charging) and the change is told once
share('edrive.json', { v: 1, t: now, app: 'eDrive Live', power: { kw: -12.4, outMax: 100, inMax: 60, old: false }, values: { soc: { pct: 73 } } });
ci.scan(); assert.deepStrictEqual(ci.sharedPower(), { kw: -12.4, old: false }); assert.strictEqual(changes, 1);
ci.scan(); assert.strictEqual(changes, 1, 'told once, not at each scan');
share('edrive.json', { v: 1, t: now, power: { kw: 35, old: true } });
ci.scan(); assert.deepStrictEqual(ci.sharedPower(), { kw: 35, old: true }); assert.strictEqual(changes, 1);

// our own file is never "another app's", a file without a power (Cluster Info's soc only) is not one either, nonsense is refused
share('cluster_themes.json', { v: 1, t: now, power: { kw: 99 } });
fs.unlinkSync(path.join(dir, 'edrive.json'));
ci.scan(); assert.strictEqual(ci.sharedPower(), null); assert.strictEqual(changes, 2);
share('other.json', { v: 1, t: now, values: { soc: { pct: 50 } } });
ci.scan(); assert.strictEqual(ci.sharedPower(), null);
share('other.json', { v: 1, t: now, power: { kw: 'x' } });
ci.scan(); assert.strictEqual(ci.sharedPower(), null);
share('other.json', { v: 1, t: now, power: { kw: 5000 } });
ci.scan(); assert.strictEqual(ci.sharedPower(), null);
fs.unlinkSync(path.join(dir, 'other.json'));

// stale: the app stopped, the power goes after 3 s and the change is told
share('edrive.json', { v: 1, t: now, power: { kw: 8 } });
ci.scan(); assert.strictEqual(ci.sharedPower().kw, 8); const before = changes;
now += 3001; ci.scan(); assert.strictEqual(ci.sharedPower(), null); assert.strictEqual(changes, before + 1);

// what we ask for: our own wanted-<id>.json, with power, at most once a second, removed on false; never Cluster Info's wanted.json
const wf = path.join(dir, 'wanted-cluster_themes.json');
ci.wantPower(true);
let w = JSON.parse(fs.readFileSync(wf, 'utf8'));
assert.strictEqual(w.power, true); assert.deepStrictEqual(w.values, []); assert.strictEqual(w.t, now);
assert.ok(!fs.existsSync(path.join(dir, 'wanted.json')));
now += 400; ci.wantPower(true); assert.strictEqual(JSON.parse(fs.readFileSync(wf, 'utf8')).t, now - 400, 'not rewritten before a second');
now += 700; ci.wantPower(true); assert.strictEqual(JSON.parse(fs.readFileSync(wf, 'utf8')).t, now);
// our own ask does not make the battery "wanted" by anyone (no values)
ci.scan(); assert.strictEqual(ci.wantsBattery(), false);
ci.wantPower(false); assert.ok(!fs.existsSync(wf));
ci.wantPower(false);   // nothing to remove: no error
// another app's own wanted file is left alone
share('wanted.json', { t: now, power: true, values: ['oil'] });
ci.wantPower(true); ci.wantPower(false);
assert.ok(fs.existsSync(path.join(dir, 'wanted.json')), "never removes Cluster Info's wanted.json");
// stop() takes our ask away too
now += 1100; ci.wantPower(true); assert.ok(fs.existsSync(wf)); ci.stop(); assert.ok(!fs.existsSync(wf));

// the wiring: the layout, the settings, hud.js
const sport = JSON.parse(fs.readFileSync(path.join(__dirname, '../apps/cluster_themes/hud/layouts/sport.json'), 'utf8'));
const byId = (id) => sport.widgets.find((x) => x.id === id);
const geo = (x) => [x.x, x.y, x.w, x.h, x.z].join(',');
assert.strictEqual(byId('boost').toggle, 'boostShown'); assert.strictEqual(byId('boost_unit').toggle, 'boostShown');
assert.strictEqual(byId('power').toggle, 'power'); assert.strictEqual(byId('power_unit').toggle, 'power');
assert.strictEqual(geo(byId('power')), geo(byId('boost')), 'the power sits where the boost sat');
assert.strictEqual(geo(byId('power_unit')), geo(byId('boost_unit')));
assert.strictEqual(byId('power').text, '{{powerKw}}'); assert.strictEqual(byId('power_unit').text, 'kW');
const app = JSON.parse(fs.readFileSync(path.join(__dirname, '../apps/cluster_themes/app.json'), 'utf8'));
const sp = (app.settings || app.items || []).find((x) => x.key === 'sportPower');
assert.ok(sp && sp.type === 'bool' && sp.default === true, 'setting sportPower (on by default)');
const main = fs.readFileSync(path.join(__dirname, '../apps/cluster_themes/main.js'), 'utf8');
assert.ok(/'sportPower'/.test(main), 'sportPower is in the settings list of the page');
const hud = fs.readFileSync(path.join(__dirname, '../shared/hud.js'), 'utf8');
['key === \'power\'', 'boostShown', 'case \'powerKw\'', 'wantPower(', '_powerChanged'].forEach((s) => assert.ok(hud.includes(s), 'hud.js: ' + s));
// no other layout shows the boost with the old toggle in the Sport's place: the other themes keep showBoost
fs.readdirSync(path.join(__dirname, '../apps/cluster_themes/hud/layouts')).filter((f) => f !== 'sport.json').forEach((f) => {
    const l = JSON.parse(fs.readFileSync(path.join(__dirname, '../apps/cluster_themes/hud/layouts', f), 'utf8'));
    assert.ok(!l.widgets.some((x) => x.toggle === 'power' || x.toggle === 'boostShown'), f + ' is untouched');
});

fs.rmSync(base, { recursive: true, force: true });
console.log('test_power: ok');
