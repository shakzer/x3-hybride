'use strict';
// The stock-style shift light on the M and Sport themes: its rpm logic, its place in the layouts, its settings.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { shiftLightState } = require('../shared/shift_light');

const ROOT = path.join(__dirname, '..');
let ok = 0;
const check = (name, fn) => { fn(); ok++; console.log('ok   ' + name); };

const O = { n: 5, from: 3000, red: 4500, flash: 5500 };
check('below the start nothing is lit; the orange lights fill one per 300 rpm up to the red', () => {
    assert.strictEqual(shiftLightState(2500, O, 0).lit, 0);
    assert.strictEqual(shiftLightState(3000, O, 0).lit, 0);
    assert.strictEqual(shiftLightState(3300, O, 0).lit, 1);
    assert.strictEqual(shiftLightState(3900, O, 0).lit, 3);
    assert.strictEqual(shiftLightState(4499, O, 0).lit, 4);
});
check('the red block comes on at 4500 (lit = n + 1) and stays on through the red zone', () => {
    assert.strictEqual(shiftLightState(4500, O, 0).lit, 6);
    assert.strictEqual(shiftLightState(5400, O, 0).lit, 6);
    assert.strictEqual(shiftLightState(6800, O, 0).lit, 6);
});
check('no flash in the red zone, 8 Hz from 5500', () => {
    for (let t = 0; t < 400; t += 10) assert.strictEqual(shiftLightState(5000, O, t).flash, false);
    const phases = new Set();
    for (let t = 0; t < 400; t += 10) phases.add(shiftLightState(5600, O, t).flash);
    assert.deepStrictEqual([...phases].sort(), [false, true]);
    assert.strictEqual(shiftLightState(5600, O, 0).flash, true);
    assert.strictEqual(shiftLightState(5600, O, 62.5).flash, false);
});
check('no rpm reading: nothing on, no flash; a start too close to the red is pulled back 500 rpm', () => {
    assert.deepStrictEqual(shiftLightState(null, O, 0), { lit: 0, flash: false });
    assert.deepStrictEqual(shiftLightState(NaN, O, 0), { lit: 0, flash: false });
    assert.strictEqual(shiftLightState(4200, { n: 5, from: 4400, red: 4500, flash: 5500 }, 0).lit, 2, 'start pulled back to 4000: 4200 is 2 of 5');
    assert.strictEqual(shiftLightState(4800, { n: 5, red: 4500, flash: 4500 }, 0).flash !== undefined, true, 'flash below red + 100 is held at red + 100');
});

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const layouts = { m: read('apps/cluster_themes/hud/layouts/m.json'), sport: read('apps/cluster_themes/hud/layouts/sport.json') };
check('M and Sport have the widget: top centre, inside the panel, clear of the centre window, setting-switched', () => {
    Object.keys(layouts).forEach((n) => {
        const w = layouts[n].widgets.find((x) => x.type === 'shiftlight');
        assert(w, n + ': no shiftlight widget');
        assert.strictEqual(w.toggle, 'stockShiftLight');
        assert(w.x + w.w <= 1920 && w.y + w.h <= 720 && w.x >= 0 && w.y >= 0, n + ' off the panel');
        assert(Math.abs(w.x + w.w / 2 - 960) <= 2, n + ' not centred');
        const hole = layouts[n].widgets.map((x) => x.hole).find(Boolean) || (n === 'm' ? [711, 171, 498, 263] : [534, 130, 852, 460]);
        assert(w.y + w.h <= hole[1], n + ': over the map window (' + (w.y + w.h) + ' > ' + hole[1] + ')');
    });
});
check('the settings exist (on, red at 4500, flash from 5500) and the page lists them', () => {
    const S = read('apps/cluster_themes/app.json').settings, by = (k) => S.find((s) => s.key === k);
    assert.strictEqual(by('stockShiftLight').default, true);
    assert.strictEqual(by('shiftLightRed').default, 4500);
    assert.strictEqual(by('shiftLightFlash').default, 5500);
    assert(by('shiftLightRed').steps.includes(4500) && by('shiftLightFlash').steps.includes(5500));
    const main = fs.readFileSync(path.join(ROOT, 'apps/cluster_themes/main.js'), 'utf8');
    ['stockShiftLight', 'shiftLightRed', 'shiftLightFlash'].forEach((k) => assert(main.includes("'" + k + "'"), k + ' not on the settings page'));
});
check('both apps ship the file (the build copies only what "shared" lists), and layouts know the type', () => {
    ['apps/cluster_themes/app.json', 'apps/idrive_hud_widgets/app.json'].forEach((f) => assert(read(f).shared.includes('shift_light.js'), f));
    assert(/shiftlight:\s*\[\]/.test(fs.readFileSync(path.join(ROOT, 'shared/layouts.js'), 'utf8')));
});
check('the shader uses no reserved GLSL ES 1.00 word as a name (half did: the layer drew nothing)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'shared/shaders.js'), 'utf8');
    const a = src.indexOf('const SHIFTLIGHT'), body = src.slice(a, src.indexOf('`;', a)).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    const reserved = 'asm class union enum typedef template this packed goto switch default inline noinline volatile public static extern external interface long short double half fixed unsigned input output hvec2 hvec3 hvec4 fvec2 fvec3 fvec4 dvec2 dvec3 dvec4 sampler1D sampler3D sampler1DShadow sampler2DShadow sampler2DRect sampler3DRect sampler2DRectShadow sizeof cast namespace using'.split(' ');
    reserved.forEach((r) => assert(!new RegExp('\\b' + r + '\\b').test(body), 'reserved word "' + r + '" in the shift light shader'));
    // and no variable named after a built-in function it also calls
    assert(!/\b(bool|float|vec[234])\s+(all|any|min|max|abs|step|mix|clamp|floor)\b/.test(body));
});
console.log('shift light: ' + ok + ' checks passed');
