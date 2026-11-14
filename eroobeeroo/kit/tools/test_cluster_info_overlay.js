'use strict';

// Cluster Info's panel over the Waze map (apps/cluster_info/overlay.js) against a fake cluster render client and a status.json
// in a temp folder: where the badge goes on each target, that it shows only while the map shows and a reading
// exists, and that updates carry only what changed. Also writes a preview of the badge:
//   node kit/tools/test_cluster_info_overlay.js [preview.png]

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');
const Module = require('module');

const ROOT = path.join(__dirname, '..', '..'), KIT = path.join(ROOT, 'kit', 'runtime');
const load = Module._load;
Module._load = function (req, parent, isMain) {
    if (req.startsWith('./kit/')) return load.call(this, path.join(KIT, req.slice(6)), parent, isMain);
    return load.call(this, req, parent, isMain);
};
const { startOverlay, mapRect, badgeRect, drawBadge, changed, parseStatus, underStrip } = require(path.join(ROOT, 'apps', 'cluster_info', 'overlay.js'));
const { Canvas } = require(path.join(KIT, 'canvas'));
const themes = require(path.join(KIT, 'themes'));
const theme = themes.theme('m_tricolour');

let ok = 0;
const check = (name, fn) => { fn(); ok++; console.log('ok   ' + name); };

/* ---------- geometry ---------- */
check('cluster map: the whole 1088x480 scene', () => assert.deepStrictEqual(mapRect('map', 0), { x: 0, y: 0, w: 1088, h: 480 }));
check('panel: the centred map area', () => assert.deepStrictEqual(mapRect('panel', 0), { x: 416, y: 120, w: 1088, h: 480 }));
check('HUD standard: 452x200 at 173,140 (as waze-on-cluster scales it)', () => assert.deepStrictEqual(mapRect('hud', 0), { x: 173, y: 140, w: 452, h: 200 }));
check('HUD at 85 %, at the right edge, both values: 52-60 high, ends inside what the HUD shows (x 680)', () => {
    const r = mapRect('hud', 85), b = badgeRect(r, 'bottom', 'hud', 2), kwOnly = badgeRect(r, 'bottom', 'hud', 0);
    assert(b.h >= 52 && b.h <= 60 && b.x >= 405 && b.x + b.w <= 680, JSON.stringify(b));
    assert.strictEqual(kwOnly.x + kwOnly.w, 676, 'a narrow panel sits at the right edge too');
});
check('HUD always, map on the cluster: the panel sits where it does with the map on the HUD (same HUD size)', () => {
    assert.deepStrictEqual(badgeRect(mapRect('hud', 85), 'bottom', 'hud', 2), badgeRect(mapRect('hud', 85), 'bottom', 'hud', 2));
});
check('HUD widest: 85 % (680x300), 100 % is held to it', () => { assert.deepStrictEqual(mapRect('hud', 85), mapRect('hud', 100)); assert.strictEqual(mapRect('hud', 85).w, 680); });
check('unknown target: none', () => assert.strictEqual(mapRect('nope', 0), null));
check('badge inside the map, bottom and top', () => {
    ['map', 'hud', 'panel'].forEach((tg) => [0, 40, 70, 100].forEach((pct) => ['bottom', 'top'].forEach((w) => {
        const r = mapRect(tg, pct), b = badgeRect(r, w, tg);
        assert(b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h, tg + ' ' + pct + ' ' + w);
        assert(b.w % 4 === 0 && b.h % 2 === 0 && b.w >= 100);
    })));
    assert.deepStrictEqual(badgeRect(mapRect('map', 0), 'bottom', 'map'), { x: 440, y: 376, w: 208, h: 72, ph: 72 });   // 1.3x, near the map's bottom (below the car's arrow, above the dimmed edge)
    assert.deepStrictEqual(badgeRect(mapRect('hud', 0), 'bottom', 'hud'), { x: 449, y: 276, w: 172, h: 60, ph: 60 });   // the HUD's, at the map's right edge
});

/* ---------- drawing and diffs ---------- */
const pw = (kw) => ({ kw, text: kw == null ? '--' : (kw < -0.3 ? '-' : '') + Math.abs(kw).toFixed(Math.abs(kw) < 10 ? 1 : 0), col: kw < -0.3 ? '#2fd27a' : theme.text });
check('the badge draws: opaque-ish backdrop, transparent corners', () => {
    const cv = new Canvas(200, 56);
    drawBadge(cv, theme, pw(23), 100, 50);
    assert.strictEqual(cv.d[3], 0, 'corner transparent');
    assert(cv.d[(28 * 200 + 100) * 4 + 3] > 150, 'middle covered');
});
check('a changed value: only its rectangles', () => {
    const a = new Canvas(200, 56), b = new Canvas(200, 56);
    drawBadge(a, theme, pw(23), 100, 50); drawBadge(b, theme, pw(23), 100, 50);
    assert.strictEqual(changed(a.d, b.d, 200, 56, 100), null);
    drawBadge(b, theme, pw(-12), 100, 50);
    const r = changed(a.d, b.d, 200, 56, 100);
    assert(r && r.length === 2);
    assert(r.reduce((n, x) => n + x.w * x.h, 0) < 200 * 56);
});

/* ---------- following the map ---------- */
class FakeCR extends EventEmitter {
    constructor(app) { super(); this.app = app; this.layers = new Map(); this.next = 1; this.log = []; FakeCR.last = this; }
    connect() { this.connected = true; setImmediate(() => this.emit('ready')); }
    close() { this.connected = false; }
    image(o) { const r = this.next++; this.layers.set(r, Object.assign({}, o)); this.log.push(['image', r, o]); return r; }
    set(r, o) { Object.assign(this.layers.get(r), o); this.log.push(['set', r, o]); }
    drop(r) { this.layers.delete(r); this.log.push(['drop', r]); }
    pixels(r, rects, px) {
        const l = this.layers.get(r);
        const need = rects ? rects.reduce((n, x) => n + x.w * x.h * 4, 0) : l.iw * l.ih * 4;
        assert.strictEqual(px.length, need, 'pixel bytes match');
        this.log.push(['pixels', r, rects]);
    }
}

(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'woc-'));
    const status = path.join(dir, 'status.json');
    const write = (o) => { fs.writeFileSync(status + '.tmp', JSON.stringify(o)); fs.renameSync(status + '.tmp', status); };
    const settings = { v: { show: 'map', place: 'bottom', bar: 'on' }, get(k) { return this.v[k]; } };
    const logs = [];
    const log = { info: (m) => logs.push(m), warn: (m) => logs.push('WARN ' + m) };
    let kw = 18, fast = 0, t = 1e6;
    let ind = 'off';
    const lv = { power: () => (kw === null ? null : pw(kw)), limits: () => ({ outMax: 100, inMax: 60 }), keepFast: () => { fast++; }, indicator: () => ind, night: () => night, extras: () => extras };
    let night = false, extras = [];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms || 30));
    // (x3-hybride: no Cluster Themes theme here, whatever runs on this machine)
    const noTheme = { themeShowing: () => false, themeWindow: () => null, slotWindow: () => null, pagesInWindow: () => false, hudPanel: () => undefined, requestWindow() {}, withdrawWindow() {} };
    const ov = startOverlay({ settings, log, theme: () => theme }, lv, { statusPath: status, ClusterRender: FakeCR, now: () => t, setInterval: () => 0, clearInterval: () => {}, yielding: noTheme });
    const step = async () => { ov._read(); await wait(); };

    await step();
    check('no status file: nothing, no connection', () => { assert.strictEqual(ov.shown(), false); assert(!FakeCR.last); });

    write({ state: 'waiting', target: 'map', hud_width_pct: 0 });
    await step();
    check('map not showing: still nothing', () => { assert.strictEqual(ov.shown(), false); assert(!FakeCR.last); });

    write({ state: 'showing', target: 'map', hud_width_pct: 0 });
    await step();
    await wait();
    const cr = FakeCR.last;
    check('map showing on the cluster: an overlay layer at its bottom, shown, fast reads asked', () => {
        assert(cr && cr.app === 'cluster_info');
        const l = [...cr.layers.values()][0];
        assert.strictEqual(l.target, 'map'); assert.strictEqual(l.klass, 'overlay');
        assert.deepStrictEqual([l.x, l.y, l.w, l.h], [440, 376, 208, 72]);
        assert.strictEqual(l.visible, true); assert(ov.shown()); assert(fast > 0);
        assert(cr.log.some((e) => e[0] === 'pixels' && e[2] === null), 'whole image first');
    });

    let n = cr.log.length;
    t += 100; ov._tick();
    check('nothing new within 250 ms of the last: no update', () => assert.strictEqual(cr.log.length, n));
    t += 16; kw = 40; ov._tick();
    check('a new value: drawn at once (the next frame), only the rectangles that changed', () => {
        const e = cr.log.slice(n).find((x) => x[0] === 'pixels');
        assert(e && Array.isArray(e[2]) && e[2].length >= 1);
    });
    t += 300;
    n = cr.log.length;
    t += 300; ov._tick();
    check('the same value again: nothing sent', () => assert.strictEqual(cr.log.length, n));

    kw = null; t += 300; ov._tick();
    check('no reading (parked): hidden', () => { assert.strictEqual(ov.shown(), false); assert.strictEqual([...cr.layers.values()][0].visible, false); });
    kw = 5; t += 300; ov._tick();
    check('a reading again: shown', () => assert(ov.shown()));

    write({ state: 'showing', target: 'hud', hud_width_pct: 0 });
    await step();
    check('the map moves to the HUD: the old layer dropped, a new one inside the HUD map', () => {
        assert(cr.log.some((e) => e[0] === 'drop'));
        const l = [...cr.layers.values()][0];
        const r = mapRect('hud', 0);
        assert.strictEqual(l.target, 'hud');
        assert(l.x >= r.x && l.y + l.h <= r.y + r.h && l.w < 200, JSON.stringify(l));
        assert(ov.shown());
    });

    write({ state: 'waiting', target: 'hud', hud_width_pct: 0, reason: 'a HUD pop-up is open' });
    await step();
    check('a HUD pop-up (the map waits): hidden, so it never asks for the slot', () => {
        assert.strictEqual(ov.shown(), false); assert.strictEqual([...cr.layers.values()][0].visible, false);
    });
    write({ state: 'showing', target: 'hud', hud_width_pct: 0 });
    await step();
    settings.v.show = 'off'; t += 300; ov._tick();
    check('setting off: hidden', () => assert.strictEqual(ov.shown(), false));
    settings.v.show = 'map'; settings.v.place = 'top'; t += 300; ov._tick();
    check('setting top: at the top of the map', () => {
        const l = [...cr.layers.values()][0], r = mapRect('hud', 0);
        assert(l.y < r.y + 20 && ov.shown(), JSON.stringify(l));
    });

    settings.v.place = 'bottom';
    write({ state: 'showing', target: 'map', hud_width_pct: 70 });
    await step();
    settings.v.show = 'hud'; t += 300; ov._tick();
    check('Always on the HUD, the map on the cluster: the panel where it is with the map on the HUD (its 70 % size), not moved up', () => {
        const l = [...cr.layers.values()][0], b = badgeRect(mapRect('hud', 70), 'bottom', 'hud', 0, true);
        assert.strictEqual(l.target, 'hud'); assert(ov.shown());
        assert.deepStrictEqual([l.x, l.y, l.w, l.h], [b.x, b.y, b.w, b.h]);
    });
    fs.unlinkSync(status);
    await step();
    t += 300; ov._tick();
    check('Always on the HUD: shown without Waze on cluster too', () => assert(ov.shown()));
    kw = null; t += 300; ov._tick();
    check('Always on the HUD, no reading: hidden', () => assert.strictEqual(ov.shown(), false));
    settings.v.show = 'map'; kw = 5; t += 300; ov._tick();
    check('Waze on cluster stopped (status gone): hidden', () => assert.strictEqual(ov.shown(), false));
    /* extras, brightness, night */
    settings.v.show = 'map'; settings.v.place = 'bottom';
    write({ state: 'showing', target: 'hud', hud_width_pct: 0 });
    await step();
    extras = [{ label: 'BATT', text: '24°' }, { label: 'OIL', text: '88°' }]; t += 300; ov._tick();
    let ml = [...cr.layers.values()].find((l) => l.klass === 'overlay' && l.w > 100);
    check('two extras: the meter wider, still inside the HUD map', () => {
        const r = mapRect('hud', 0);
        assert(ml && ml.w > 140 && ml.x >= r.x && ml.x + ml.w <= r.x + r.w, JSON.stringify(ml));
    });
    settings.v.hudBrightness = 50; t += 300; ov._tick();
    check('HUD brightness 50 %: the meter at half opacity', () => assert.strictEqual(ml.opacity, 0.5));
    settings.v.hudBrightness = 100; night = true; t += 300; ov._tick();
    check('night: dimmer', () => assert(ml.opacity < 1 && ml.opacity > 0.4));
    settings.v.nightDim = 'off'; t += 300; ov._tick();
    check('night dimming off: full', () => assert.strictEqual(ml.opacity, 1));
    check('status for the diagnostics', () => { const st = ov.status(); assert(/connected|connecting/.test(st.renderer) && /hud/.test(st.map)); });
    extras = []; night = false; settings.v.nightDim = 'on';

    /* the kW without its bar on the HUD (setting bar 'cluster', the default), with it on the cluster */
    t += 300; ov._tick();
    const withBar = [...cr.layers.values()].find((l) => l.klass === 'overlay' && l.visible && l.h > 30);
    settings.v.bar = 'cluster'; t += 300; ov._tick();
    const noBar = [...cr.layers.values()].find((l) => l.klass === 'overlay' && l.visible && l.h > 30);
    check('kW only on the HUD: a narrower panel without the bar', () => assert(withBar && noBar && noBar.w < withBar.w, JSON.stringify([withBar && withBar.w, noBar && noBar.w])));
    check('the panel geometry without a bar is narrower than with it', () => {
        const r = mapRect('hud', 70);
        assert(badgeRect(r, 'bottom', 'hud', 2, 'number').w < badgeRect(r, 'bottom', 'hud', 2, true).w || badgeRect(r, 'bottom', 'hud', 2, 'number').h > badgeRect(r, 'bottom', 'hud', 2, true).h);
    });
    settings.v.bar = 'on';

    /* the kW meter in any slot: drawn after the values in slots before it */
    check('the kW meter in the middle slot: a value, the meter, a value (pixels differ from meter-first)', () => {
        const ex = [{ label: 'OIL', text: '88°', slot: 0 }, { label: 'BATT', text: '24°', slot: 2 }];
        const b = badgeRect(mapRect('map', 0), 'bottom', 'map', 2, true);
        const a1 = new Canvas(b.w, b.h), a2 = new Canvas(b.w, b.h);
        drawBadge(a1, theme, Object.assign(pw(12), { bar: true }), 100, 50, ex, 0);
        drawBadge(a2, theme, Object.assign(pw(12), { bar: true }), 100, 50, ex, 1);
        assert(changed(a1.d, a2.d, b.w, b.h, Math.round(b.w / 2)));
        // the left quarter of meter-in-the-middle holds a value's text, no bar track
        const q = Math.round(b.w / 4);
        let lit = 0;
        for (let y = 0; y < b.h; y++) for (let x = 0; x < q; x++) if (a2.d[(y * b.w + x) * 4] > 200) lit++;
        assert(lit > 0);
    });

    /* no power provider (a car without eDrive Live): the values alone */
    kw = null; extras = [{ label: 'OIL', text: '88°' }, { label: 'COOL', text: '90°' }]; t += 300; ov._tick();
    ml = [...cr.layers.values()].find((l) => l.klass === 'overlay' && l.w > 60 && l.h > 30 && l.visible);
    check('no power, two values: a values-only panel, narrower than with the meter', () => assert(ov.shown() && ml && ml.w < 232, JSON.stringify(ml)));
    extras = [{ label: 'OIL', text: '--' }]; t += 300; ov._tick();
    check('nothing with a reading: hidden', () => assert.strictEqual(ov.shown(), false));
    kw = 5; extras = [];

    /* turn signals: arrows on the HUD, blinking by opacity only */
    const sets = () => cr.log.filter((e) => e[0] === 'set').length;
    ov._arrowTick();
    check('no signal: no arrows', () => assert(!ov.arrows().shown && !ov.arrows().refs.left));
    ind = 'left'; t += 10; ov._arrowTick();
    const refs = ov.arrows().refs, la = cr.layers.get(refs.left), ra = cr.layers.get(refs.right);
    check('left: both arrows made on the HUD, small, at its top; the left lit at once', () => {
        assert(la.target === 'hud' && ra.target === 'hud' && la.y < 200 && la.w <= 32 && la.x < ra.x);
        assert(ov.arrows().shown && la.visible && la.opacity === 1 && ra.opacity === 0);
    });
    const px0 = cr.log.filter((e) => e[0] === 'pixels').length;
    t += 400; ov._arrowTick();
    check('blinks at the cluster arrow rate: off after 335 ms', () => assert(la.opacity === 0 && la.visible));
    t += 400; ov._arrowTick();
    check('and on again, with no pixels sent', () => assert(la.opacity === 1 && cr.log.filter((e) => e[0] === 'pixels').length === px0));
    const n0 = sets();
    t += 50; ov._arrowTick();
    check('nothing sent between flashes', () => assert.strictEqual(sets(), n0));
    ind = 'both'; t += 10; ov._arrowTick();
    check('hazards: both lit', () => assert(la.opacity === 1 && ra.opacity === 1));
    // the flash edges where the cluster's are (measured: 640 ms a flash, 638 by the head unit's clock, lit 335, the
    // head unit told 40 ms after the cluster's first flash)
    const seq = [];
    ind = 'right'; ov._arrowTick(); seq.push(ra.opacity);
    for (const dt of [290, 10, 290, 10]) { t += dt; ov._arrowTick(); seq.push(ra.opacity); }
    check('flash timing: lit to 295 ms after the stalk news, dark, lit again from 598 ms', () => assert.deepStrictEqual(seq, [1, 1, 0, 0, 1]));
    ind = 'off'; t += 10; ov._arrowTick();
    check('let go: dark, still placed for a moment', () => assert(la.opacity === 0 && ov.arrows().shown));
    t += 1300; ov._arrowTick();
    check('then hidden (the HUD slot let go)', () => assert(!ov.arrows().shown && !la.visible));
    settings.v.turnSignals = 'off'; ind = 'right'; t += 10; ov._arrowTick();
    check('setting off: no arrows', () => assert(!ov.arrows().shown));
    ov.stop();

    if (process.argv[2]) {
        const big = new Canvas(640, 160);
        big.clear([40, 70, 110, 255]);
        [[23, 0, 0], [-14.5, 220, 0], [4.2, 0, 80], [85, 220, 80]].forEach(([v, x, y]) => {
            const c = new Canvas(200, 56); drawBadge(c, theme, pw(v), 100, 50);
            const h = new Canvas(124, 34); drawBadge(h, theme, pw(v), 100, 50);
            [[c, x + 10, y + 10], [h, x + 10 + 0, y + 0]].slice(0, 1).forEach(([s, ox, oy]) => blend(big, s, ox, oy));
            blend(big, h, 460 + (x ? 0 : 0), y + (x ? 40 : 0) + 10);
        });
        fs.writeFileSync(process.argv[2], big.png());
        console.log('preview: ' + process.argv[2]);
    }
    /* Robert's Waze on cluster (robertnisipeanu/idrive-apps): status.json names the cluster's target and the HUD apart */
check('status: the original Waze on cluster on the cluster, on the HUD alone, on both, off', () => {
    const base = { ev: 'status', state: 'showing', target: 'map', cluster: 1, hud: 0, hud_state: 'off', hud_width_pct: 70, hud_x: 0, hud_y: 40 };
    assert.deepStrictEqual(parseStatus(base), { showing: true, target: 'map', pct: 70, hx: 0, hy: 40 });
    assert.deepStrictEqual(parseStatus(Object.assign({}, base, { cluster: 0, state: 'off', hud: 1, hud_state: 'showing' })), { showing: true, target: 'hud', pct: 70, hx: 0, hy: 40 });
    assert.strictEqual(parseStatus(Object.assign({}, base, { hud: 1, hud_state: 'showing' })).target, 'map', 'both: the cluster');
    assert.strictEqual(parseStatus(Object.assign({}, base, { state: 'idle', hud: 1, hud_state: 'starting' })).showing, false);
    // the older build's form still reads
    assert.deepStrictEqual(parseStatus({ state: 'showing', target: 'map+hud', hud_width_pct: 0 }), { showing: true, target: 'map', pct: 0, hx: 0, hy: 0 });
    assert.strictEqual(parseStatus({ state: 'showing', target: 'hud', hud_width_pct: 60 }).target, 'hud');
});
check('the HUD map moved by its offset: the panel moves with it, held inside the HUD', () => {
    const a = mapRect('hud', 70), b = mapRect('hud', 70, 0, 40), c = mapRect('hud', 70, 0, 900);
    assert.strictEqual(b.y, a.y + 40); assert.strictEqual(b.x, a.x);
    assert.strictEqual(c.y + c.h, 480, 'held inside');
    assert.deepStrictEqual(mapRect('map', 0, 50, 50), mapRect('map', 0), 'the cluster map has no offset');
    const bb = badgeRect(b, 'bottom', 'hud', 1, true, true);
    assert(bb.y + bb.h <= 400, 'the panel and its thin bar above the HUD\'s visible bottom: ' + (bb.y + bb.h));
    assert.strictEqual(badgeRect(mapRect('hud', 70, 0, -40), 'bottom', 'hud', 1).y, badgeRect(a, 'bottom', 'hud', 1).y - 40, 'moved up: follows');
});
check('the thin kW bar: in a strip above the panel, the panel where it was, the layer that much taller', () => {
    const r = mapRect('map', 0), off = badgeRect(r, 'bottom', 'map', 2, true), on = badgeRect(r, 'bottom', 'map', 2, true, true);
    const u = underStrip(off.ph);
    assert.strictEqual(on.ph, off.ph); assert.strictEqual(on.h, off.h + u.total); assert.strictEqual(on.y + on.h, off.y + off.h, 'the panel\'s bottom where it was');
    // drawn: the panel's rows the same as without the bar (one strip lower in the layer), the bar above them
    const { Canvas } = require(path.join(ROOT, 'kit', 'runtime', 'canvas'));
    const t = require(path.join(ROOT, 'kit', 'runtime', 'themes')).theme('m_tricolour');
    const cv = new Canvas(on.w, on.h), plain = new Canvas(off.w, off.h);
    const ex = [{ label: 'OIL', text: '201°' }, { label: 'COOL', text: '203°' }];
    drawBadge(cv, t, null, 100, 50, ex, 0, { kw: 30 }, on.ph);
    drawBadge(plain, t, null, 100, 50, ex, 0, null, off.ph);
    const px = (c, x, y) => Array.from(c.d.slice((y * c.w + x) * 4, (y * c.w + x) * 4 + 4)).join(',');
    let panelDiff = 0, inStrip = 0;
    for (let y = 0; y < on.h; y++) for (let x = 0; x < on.w; x++) {
        if (y >= u.total) { if (px(cv, x, y) !== px(plain, x, y - u.total)) panelDiff++; } else if (px(cv, x, y) !== '0,0,0,0') inStrip++;
    }
    assert.strictEqual(panelDiff, 0, 'the panel moved or drawn over'); assert(inStrip > 50, 'the bar drawn above it: ' + inStrip);
});

/* ---------- x3-hybride: inside a Cluster Themes theme's centre window (M: 510x275 at 705,165 on the panel, inset 6) ---------- */
const M_WIN = { x: 711, y: 171, w: 498, h: 263 }, S_WIN = { x: 534, y: 130, w: 852, h: 460 };   // on the panel
const slot = (w) => ({ x: w.x - 416, y: w.y - 120, w: w.w, h: w.h });
check('a narrow window (M\'s): the panel is made smaller until it fits, inside the window at its bottom', () => {
    const r = slot(M_WIN), b = badgeRect(r, 'bottom', 'map', 2, true);
    assert(b.w <= r.w - 8 && b.x >= r.x && b.x + b.w <= r.x + r.w, JSON.stringify(b));
    assert(b.y >= r.y && b.y + b.h <= r.y + r.h, JSON.stringify(b));
    assert(b.h >= 40, 'still readable: ' + b.h);
});
check('the same window at the top: inside it, above the bottom one', () => {
    const r = slot(M_WIN), top = badgeRect(r, 'top', 'map', 2, true), bot = badgeRect(r, 'bottom', 'map', 2, true);
    assert(top.y >= r.y && top.y < bot.y && top.y + top.h <= r.y + r.h, JSON.stringify([top, bot]));
});
check('a wide window (Sport\'s): the panel as on the whole map', () => {
    const r = slot(S_WIN), b = badgeRect(r, 'bottom', 'map', 2, true);
    assert.strictEqual(b.h, badgeRect(mapRect('map', 0), 'bottom', 'map', 2, true).h);
    assert(b.x >= r.x && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h, JSON.stringify(b));
});
{
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'woc-win-'));
    const status = path.join(dir, 'status.json');
    const write = (o) => { fs.writeFileSync(status + '.tmp', JSON.stringify(o)); fs.renameSync(status + '.tmp', status); };
    const settings = { v: { show: 'map', place: 'bottom', bar: 'on' }, get(k) { return this.v[k]; } };
    const log = { info() {}, warn() {} };
    let t = 2e6, win = null, pages = false, themeUp = true;
    const asks = [];
    const Y = {
        themeShowing: () => themeUp, themeWindow: () => win, pagesInWindow: () => pages, hudPanel: () => undefined,
        slotWindow: () => (win ? slot(win) : null),
        requestWindow: (app, extra) => asks.push([app, extra]), withdrawWindow: (app) => asks.push([app, null]),
    };
    const lv = { power: () => ({ kw: 12, text: '12', col: '#fff' }), limits: () => ({ outMax: 100, inMax: 60 }), keepFast() {}, indicator: () => 'off', night: () => false, extras: () => [{ label: 'OIL', text: '88\u00b0' }, { label: 'COOL', text: '90\u00b0' }] };
    let poll = null;      // (the 1 s poll: the status read and the ask for the window)
    const ov = startOverlay({ settings, log, theme: () => theme }, lv, { statusPath: status, ClusterRender: FakeCR, now: () => t, setInterval: (fn, ms) => { if (ms === 1000) poll = fn; return 0; }, clearInterval: () => {}, yielding: Y });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms || 30));
    const step = async () => { ov._read(); await wait(); t += 300; ov._tick(); };
    const layer = () => [...FakeCR.last.layers.values()].find((l) => l.klass === 'overlay' && l.visible);

    write({ state: 'idle', target: 'map', hud_width_pct: 0 });
    await step();
    check('a theme shows but its window is closed, no Waze: nothing drawn', () => assert(!ov.shown()));

    win = M_WIN;
    await step();
    check('the window open, no Waze map: the panel alone in it, on the map\'s slot, taking the slot (contend)', () => {
        const l = layer(), r = slot(M_WIN);
        assert(l && l.target === 'map' && l.contend === true, JSON.stringify(l));
        assert(l.x >= r.x && l.y >= r.y && l.x + l.w <= r.x + r.w && l.y + l.h <= r.y + r.h, JSON.stringify([l, r]));
    });
    pages = true; await step();
    check('Cluster Centre\'s pages in the window: the panel steps aside (the pages show the same values)', () => assert(!ov.shown()));
    pages = false;

    write({ state: 'showing', target: 'map', cluster: 1, hud: 0, hud_width_pct: 0 });
    await step();
    check('Waze showing on the map slot, window open: the panel inside the window, not at the map\'s bottom edge', () => {
        const l = layer(), r = slot(M_WIN);
        assert(l && l.target === 'map' && !l.contend, JSON.stringify(l));
        assert(l.y + l.h <= r.y + r.h && l.x >= r.x && l.x + l.w <= r.x + r.w, JSON.stringify([l, r]));
    });
    write({ state: 'showing', target: 'panel', cluster: 1, hud: 0, hud_width_pct: 0 });
    await step();
    check('Waze inside the theme (on the panel): the panel inside the window, in panel pixels', () => {
        const l = layer();
        assert(l && l.target === 'panel', JSON.stringify(l));
        assert(l.x >= M_WIN.x && l.y >= M_WIN.y && l.x + l.w <= M_WIN.x + M_WIN.w && l.y + l.h <= M_WIN.y + M_WIN.h, JSON.stringify(l));
    });
    win = S_WIN; await step();
    check('another theme (Sport): the panel moves with the window', () => {
        const l = layer();
        assert(l && l.x >= S_WIN.x && l.x + l.w <= S_WIN.x + S_WIN.w && l.y + l.h <= S_WIN.y + S_WIN.h, JSON.stringify(l));
    });
    win = null; await step();
    check('the window closed with Waze still showing: back to the map\'s own rectangle', () => {
        const l = layer(), r = mapRect('panel', 0);
        assert(l && l.target === 'panel' && l.y + l.h <= r.y + r.h && l.y > r.y + r.h - 140, JSON.stringify(l));
    });
    check('while a theme shows and the panel is for the map, it asks for the window', () => {
        asks.length = 0; poll();
        const a = asks.filter((x) => x[0] === 'cluster_info').pop();
        assert(a && a[1] && a[1].kind === 'panel' && typeof a[1].showing === 'boolean', JSON.stringify(asks));
        assert(/in the theme's centre window/.test(ov.status().map) === false, 'closed now: not said');
    });
    check('no theme, or the panel on the HUD: it stops asking', () => {
        themeUp = false; asks.length = 0; poll();
        assert.deepStrictEqual(asks.pop(), ['cluster_info', null]);
        themeUp = true; settings.v.show = 'hud'; asks.length = 0; poll();
        assert.deepStrictEqual(asks.pop(), ['cluster_info', null]);
    });
    win = M_WIN; settings.v.show = 'map';
    check('the status line says so while the window is open', () => assert(/in the theme's centre window/.test(ov.status().map)));
    ov.stop();
}
{
    // x3-hybride: "Always on the HUD" under HUD Widgets: the panel goes in the room the layout leaves, or nowhere
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'woc-room-'));
    const status = path.join(dir, 'status.json');
    const write = (o) => { fs.writeFileSync(status + '.tmp', JSON.stringify(o)); fs.renameSync(status + '.tmp', status); };
    const settings = { v: { show: 'hud', place: 'bottom', bar: 'on' }, get(k) { return this.v[k]; } };
    const log = { info() {}, warn() {} };
    let t = 3e6, room;
    const Y = { themeShowing: () => false, themeWindow: () => null, pagesInWindow: () => false, slotWindow: () => null, hudPanel: () => room, requestWindow() {}, withdrawWindow() {} };
    const lv = { power: () => ({ kw: 12, text: '12', col: '#fff' }), limits: () => ({ outMax: 100, inMax: 60 }), keepFast() {}, indicator: () => 'off', night: () => false, extras: () => [{ label: 'OIL', text: '88\u00b0' }, { label: 'COOL', text: '90\u00b0' }] };
    const ov = startOverlay({ settings, log, theme: () => theme }, lv, { statusPath: status, ClusterRender: FakeCR, now: () => t, setInterval: () => 0, clearInterval: () => {}, yielding: Y });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms || 30));
    const step = async () => { ov._read(); await wait(); t += 300; ov._tick(); };
    const layer = () => [...FakeCR.last.layers.values()].find((l) => l.klass === 'overlay' && l.visible);
    write({ state: 'idle', target: 'map', hud_width_pct: 0 });

    room = { x: 356, y: 188, w: 324, h: 120 };
    await step();
    check('HUD layout room: the panel is drawn on the HUD, inside the room, 60 high at most', () => {
        const l = layer();
        assert(l && l.target === 'hud', JSON.stringify(l));
        assert(l.x >= room.x && l.y >= room.y && l.x + l.w <= room.x + room.w && l.y + l.h <= room.y + room.h, JSON.stringify([l, room]));
        assert(l.h <= 60, 'height ' + l.h);
    });
    room = { x: 356, y: 336, w: 324, h: 44 };
    await step();
    check('a low, narrow room (44 high): the panel shrinks to fit it, no further than it', () => {
        const l = layer();
        assert(l && l.y >= room.y && l.y + l.h <= room.y + room.h && l.x >= room.x && l.x + l.w <= room.x + room.w, JSON.stringify([l, room]));
    });
    room = null;
    await step();
    check('the layout leaves no room: nothing drawn, so nothing is covered', () => assert(!ov.shown() && !layer()));
    room = undefined;
    await step();
    check('no HUD Widgets layout: the panel where it always was, on the HUD', () => {
        const l = layer();
        assert(l && l.target === 'hud', JSON.stringify(l));
    });
    ov.stop();
}
console.log(ok + ' checks passed');
})().catch((e) => { console.error(e); process.exit(1); });

function blend(dst, src, ox, oy) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4, j = ((oy + y) * dst.w + ox + x) * 4, a = src.d[i + 3] / 255;
        for (let k = 0; k < 3; k++) dst.d[j + k] = src.d[i + k] * a + dst.d[j + k] * (1 - a);
    }
}
