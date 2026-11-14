'use strict';
// node tools/test_danger.js: the danger zone alert (shared/danger.js: the files another app writes, the distance and limit
// as shown) and how the app and the two themes that draw it are wired.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { Danger, formatDistance, formatLimit, STALE_MS } = require('../shared/danger');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'danger-test-'));
let now = 5000000, changes = 0;
const log = { info: () => {}, warn: () => {} };
const d = new Danger({ dir, now: () => now }, log, () => { changes++; });
const put = (name, obj) => fs.writeFileSync(path.join(dir, name), typeof obj === 'string' ? obj : JSON.stringify(obj));

// nothing there: off, nothing announced
d.scan();
assert.deepStrictEqual(d.state(), { on: false, distM: null, limit: null, app: '' });
assert.strictEqual(changes, 0);

// a zone ahead with its limit: on, once
put('danger-a.json', { t: now, app: 'a', distance: 350, limit: 50 });
d.scan();
assert.deepStrictEqual(d.state(), { on: true, distM: 350, limit: 50, app: 'a' });
assert.strictEqual(changes, 1);
d.scan(); assert.strictEqual(changes, 1, 'no change, nothing announced');

// the distance counting down is not a change of state (the text is read live), the limit going away is
put('danger-a.json', { t: now, app: 'a', distance: 300, limit: 50 });
d.scan(); assert.strictEqual(d.state().distM, 300); assert.strictEqual(changes, 1);
put('danger-a.json', { t: now, app: 'a', distance: 290 });
d.scan(); assert.strictEqual(d.state().limit, null); assert.strictEqual(changes, 2);

// the nearest of two sources wins
put('danger-b.json', { t: now, app: 'b', distance: 120, limit: 30 });
d.scan(); assert.strictEqual(d.state().app, 'b'); assert.strictEqual(d.state().limit, 30);

// bad files are ignored: not JSON, no time, a stale or a future time, a bad distance, other names
put('danger-b.json', '{ not json');
put('danger-c.json', { app: 'c', distance: 10 });
put('danger-d.json', { t: now - STALE_MS, app: 'd', distance: 10 });
put('danger-e.json', { t: now + STALE_MS + 1, app: 'e', distance: 10 });
put('danger-f.json', { t: now, app: 'f', distance: -5 });
put('danger-g.json', { t: now, app: 'g', distance: '10' });
put('danger-h.json', { t: now, app: 'h', distance: 20001 });
put('danger.json', { t: now, app: 'i', distance: 5 });
put('danger-x.txt', { t: now, app: 'j', distance: 5 });
put('window-k.json', { t: now, app: 'k', distance: 5 });
d.scan();
assert.strictEqual(d.state().app, 'a', 'only the good file counts');
assert.strictEqual(d.state().distM, 290);

// (the bad files are cleared, so that time passing makes none of them good: a time ahead becomes the present)
fs.readdirSync(dir).filter((n) => n !== 'danger-a.json').forEach((n) => fs.unlinkSync(path.join(dir, n)));

// a limit that makes no sense is no limit
put('danger-a.json', { t: now, app: 'a', distance: 290, limit: 3 }); d.scan(); assert.strictEqual(d.state().limit, null);
put('danger-a.json', { t: now, app: 'a', distance: 290, limit: 130.4 }); d.scan(); assert.strictEqual(d.state().limit, 130);

// the source stops writing: gone after STALE_MS
const before = changes;
now += STALE_MS - 1; d.scan(); assert.strictEqual(d.state().on, true);
now += 1; d.scan(); assert.strictEqual(d.state().on, false);
assert.strictEqual(changes, before + 1);

// a folder that doesn't exist is no zone, and no error
const gone = new Danger({ dir: path.join(dir, 'nope'), now: () => now }, log, () => { throw new Error('nothing to announce'); });
gone.scan(); assert.strictEqual(gone.state().on, false);

// the distance as shown
assert.deepStrictEqual(formatDistance(349, false), { n: '350', unit: 'm' });
assert.deepStrictEqual(formatDistance(3, false), { n: '10', unit: 'm' });
assert.deepStrictEqual(formatDistance(996, false), { n: '1.0', unit: 'km' });
assert.deepStrictEqual(formatDistance(1240, false), { n: '1.2', unit: 'km' });
assert.deepStrictEqual(formatDistance(200, true), { n: '650', unit: 'ft' });
assert.deepStrictEqual(formatDistance(350, true), { n: '0.2', unit: 'mi' });
assert.deepStrictEqual(formatDistance(null, false), { n: '--', unit: 'km' });
assert.strictEqual(formatLimit(50, false), '50');
assert.strictEqual(formatLimit(50, true), '30');
assert.strictEqual(formatLimit(130, true), '80');
assert.strictEqual(formatLimit(null, false), '');

// the wiring: both apps ship the file, the setting is off by default, the two themes draw the alert
const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
['apps/cluster_themes/app.json', 'apps/idrive_hud_widgets/app.json'].forEach((f) => assert(read(f).shared.includes('danger.js'), f + ' ships danger.js'));
const set = read('apps/cluster_themes/app.json').settings.find((s) => s.key === 'dangerAlert');
assert(set && set.type === 'bool' && set.default === false, 'dangerAlert is a bool, off by default');
['mblade', 'navi'].forEach((n) => {
    const L = read('apps/cluster_themes/hud/layouts/' + n + '.json');
    const by = (id) => L.widgets.find((w) => w.id === id);
    ['al_card', 'al_card2', 'al_cam', 'al_title', 'al_dist', 'al_unit', 'al_ring', 'al_limit'].forEach((id) => assert(by(id), n + ' has ' + id));
    assert.strictEqual(by('al_card').type, 'box'); assert.strictEqual(by('al_card').toggle, 'dangerLimit');
    assert.strictEqual(by('al_card2').toggle, 'dangerNoLimit');
    assert(by('al_card2').w < by('al_card').w, 'the card without the limit is the narrower');
    ['al_cam', 'al_title', 'al_dist', 'al_unit'].forEach((id) => assert.strictEqual(by(id).toggle, 'danger', n + ' ' + id));
    ['al_ring', 'al_limit'].forEach((id) => assert.strictEqual(by(id).toggle, 'dangerLimit', n + ' ' + id));
    assert.strictEqual(by('al_dist').text, '{{dangerDist}}'); assert.strictEqual(by('al_unit').text, '{{dangerUnit}}'); assert.strictEqual(by('al_limit').text, '{{dangerLimit}}');
    // the card without the limit is a prefix of the other: the same corner, so it grows to the right
    assert(by('al_card').x === by('al_card2').x && by('al_card').y === by('al_card2').y && by('al_card').h === by('al_card2').h);
    // the ring sits inside the wide card, the unit before it
    assert(by('al_ring').x + by('al_ring').w <= by('al_card').x + by('al_card').w, n + ' ring inside the card');
    assert(by('al_unit').x + by('al_unit').w <= by('al_ring').x, n + ' the unit ends before the ring');
    assert(by('al_cam').icon === 'cam' && by('al_ring').icon === 'ring');
});
require('../shared/icons').ICONS.cam && require('../shared/icons').ICONS.ring;
console.log('danger: ok');
fs.rmSync ? fs.rmSync(dir, { recursive: true, force: true }) : null;
