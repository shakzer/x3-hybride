'use strict';
// The two Cluster Themes layouts copied from the screenshot: "M Blade" (mblade) and "Navi" (navi). Checks that they are
// listed in every theme setting, carry what the owner asked for (the hybrid battery where the photo has the oil gauge, the
// oil temperature in the free space on the right, the ONE OF ONE lettering (Navi only, centred under the shift light, gone while the Waze window is open),
// the shift light where BMW's own sits), keep clear of BMW's black box, seat-belt light and the hood, and cut the map window
// that Cluster Centre / Cluster Info read. Run: node tools/test_mblade_navi.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const visible = require('../shared/visible');

const ROOT = path.join(__dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const app = read('apps/cluster_themes/app.json');
const NAMES = ['mblade', 'navi'];
let bad = 0;
function check(what, fn) { try { fn(); } catch (e) { bad++; console.log('FAIL ' + what + ': ' + e.message); } }
const overlap = (w, z) => w.x < z[2] && w.x + w.w > z[0] && w.y < z[3] && w.y + w.h > z[1];

NAMES.forEach((n) => {
    const L = read('apps/cluster_themes/hud/layouts/' + n + '.json');
    const by = (id) => L.widgets.find((w) => w.id === id);
    const ofType = (t) => L.widgets.filter((w) => w.type === t);

    check(n + ': listed in the four theme settings', () => {
        ['hudLayout', 'inHybrid', 'inSport', 'inEco'].forEach((k) => {
            const s = app.settings.find((x) => x.key === k);
            assert(s && s.options.some((o) => o[0] === n), k + ' lacks ' + n);
        });
    });
    check(n + ': ids unique, panel layout, every widget inside 1920x720', () => {
        assert.strictEqual(L.schemaVersion, 2);
        const ids = L.widgets.map((w) => w.id);
        assert.strictEqual(new Set(ids).size, ids.length, 'duplicate widget id');
        L.widgets.forEach((w) => { if (typeof w.x === 'number') assert(w.x >= 0 && w.y >= 0 && w.x + w.w <= 1920 && w.y + w.h <= 720, w.id + ' off the panel'); });
    });
    check(n + ': the battery is where the photo has the oil gauge, the oil temperature is its own readout', () => {
        const toks = L.widgets.filter((w) => w.type === 'text').map((w) => w.text);
        ['{{hvSoc}}', '{{evRange}}', '{{oil}}', '{{range}}'].forEach((t) => assert(toks.includes(t), 'no ' + t));
        assert(L.widgets.some((w) => w.type === n), 'no ' + n + ' shader widget');
    });
    check(n + ': the oil readout sits in the free column on the right, clear of BMW\'s gear box', () => {
        const oil = by('oil'), icon = by('oil_icon');
        assert(oil && icon, 'no oil readout');
        assert(oil.x >= 1600 && !overlap(oil, visible.BLACK_BOX) && !overlap(icon, visible.BLACK_BOX));
    });
    check(n + ': ONE OF ONE lettering: only in Navi, centred right under the shift light, gone while the map window is open', () => {
        const e = by('emblem');
        if (n === 'mblade') { assert(!e, 'M Blade has no room for it'); return; }
        assert(e && e.type === 'emblem' && e.setting === 'emblem' && !e.keepWithMap, 'must be hidden while the window is open');
        assert(Math.abs(e.x + e.w / 2 - 960) <= 2, 'not centred');
        const s = ofType('shiftlight')[0];
        assert(e.y >= s.y + s.h && e.y + 96 <= 215, 'not between the shift light and the gear');
    });
    check(n + ': shift light centred at the top, switched by stockShiftLight, above the map window', () => {
        const s = ofType('shiftlight')[0];
        assert(s && s.toggle === 'stockShiftLight');
        assert(Math.abs(s.x + s.w / 2 - 960) <= 2, 'not centred');
        const hole = L.widgets.map((w) => w.hole).find(Boolean);
        assert(hole && s.y + s.h <= hole[1], 'over the map window');
    });
    check(n + ': the centre window: a hole, shown while Waze is up, plus the Cluster Centre rectangle', () => {
        const h = L.widgets.find((w) => w.hole);
        assert(h && h.holeWhen === 'mapUp' && h.hole.length === 4 && h.holeInset > 0);
        assert(L.widgets.some((w) => w.toggle === 'mapUp') && L.widgets.some((w) => w.toggle === '!mapUp'), 'no open / closed readouts');
    });
    check(n + ': the window covers the middle of Waze\'s map (it is drawn at x 416..1504, y 120..600 and cannot be moved) and clears the black box', () => {
        const h = L.widgets.find((w) => w.hole), i = h.holeInset || 6;
        const win = { x: h.hole[0] + i, y: h.hole[1] + i, w: h.hole[2] - 2 * i, h: h.hole[3] - 2 * i };
        assert(win.x <= 900 && win.x + win.w >= 1000, 'x 900..1000 (around the map\'s middle, x 960) is not in it');
        assert(win.y <= 360 && win.y + win.h >= 590, 'the map\'s middle and its lower part (y 360..590, where the arrow is) are not in it');
        assert(!overlap(win, visible.BLACK_BOX) && !overlap(win, visible.BELT), 'under BMW\'s black box or belt light');
    });
    check(n + ': no text, icon or emblem in BMW\'s black box or seat-belt light, none under the hood', () => {
        L.widgets.filter((w) => /^(text|icon|emblem|badge|atext)$/.test(w.type)).forEach((w) => {
            assert(!overlap(w, visible.BLACK_BOX), w.id + ' in the black box');
            assert(!overlap(w, visible.BELT), w.id + ' in the seat-belt light');
            const a = w.type === 'emblem' ? w.x + 114 : w.x, b = w.type === 'emblem' ? w.x + 246 : w.x + w.w;    // (the emblem's ink is 132 px wide, centred in its 360 px box)
            assert(visible.hoodY(a) <= w.y + 2 && visible.hoodY(b) <= w.y + 2, w.id + ' under the hood');
        });
    });
});
console.log(bad ? bad + ' FAILED' : 'mblade / navi: all checks pass');
process.exit(bad ? 1 : 0);
