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

fs.rmSync ? fs.rmSync(base, { recursive: true, force: true }) : null;
console.log('cluster_info: ok');
