'use strict';
// The emblem widget's painter (shared/emblems.js): a clear box without a mask, the gradient's two ends are the M theme's
// light blue and red, the middle is the dark blue (no purple), and every baked mask fits its box. Run: node tools/test_emblems.js
const fs = require('fs');
const path = require('path');
const { paintEmblem } = require('../shared/emblems');
const { M_STRIPE } = require('../shared/hud_themes');
let bad = 0;
function ok(what, cond) { if (!cond) { bad++; console.log('FAIL ' + what); } }
const px = (buf, w, x, y) => Array.from(buf.slice((y * w + x) * 4, (y * w + x) * 4 + 4));

ok('no mask: a clear box', paintEmblem(null, 10, 4).every((b) => b === 0));
ok('a mask bigger than the box: a clear box', paintEmblem({ w: 20, h: 2, alpha: Buffer.alloc(40, 255).toString('base64') }, 10, 4).every((b) => b === 0));
const w = 100, mask = { w, h: 1, alpha: Buffer.alloc(w, 255).toString('base64') };
const out = paintEmblem(mask, w, 1);
const l = px(out, w, 0, 0), m = px(out, w, 48, 0), r = px(out, w, w - 1, 0);
ok('left end is the M light blue', l[0] === M_STRIPE[0][0] && l[1] === M_STRIPE[0][1] && l[2] === M_STRIPE[0][2] && l[3] === 255);
ok('middle is the M dark blue', Math.abs(m[0] - M_STRIPE[1][0]) <= 2 && Math.abs(m[2] - M_STRIPE[1][2]) <= 2);
ok('right end is the M red', r[0] === M_STRIPE[2][0] && r[1] === M_STRIPE[2][1] && r[2] === M_STRIPE[2][2]);
// no pink: where it blends from blue to red the green stays low and red stays under the red's own
for (let x = 0; x < w; x++) { const p = px(out, w, x, 0); ok('x ' + x + ' not brighter than the red', p[0] <= M_STRIPE[2][0]); }
// the transparent padding stays clear
const wide = paintEmblem({ w: 10, h: 2, alpha: Buffer.alloc(20, 255).toString('base64') }, 20, 6);
ok('padding clear, ink centred', px(wide, 20, 0, 0)[3] === 0 && px(wide, 20, 5, 2)[3] === 255 && px(wide, 20, 15, 2)[3] === 0);
// every baked mask fits the 600 x 130 box in sport.json
const dir = path.join(__dirname, '..', 'apps', 'cluster_themes', 'hud', 'emblems');
const layout = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'apps', 'cluster_themes', 'hud', 'layouts', 'sport.json'), 'utf8'));
const box = layout.widgets.filter((x) => x.type === 'emblem')[0];
ok('sport.json has the emblem widget', !!box);
fs.readdirSync(dir).filter((f) => /\.json$/.test(f)).forEach((f) => {
    const e = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    ok(f + ' fits the box', box && e.w <= box.w && e.h <= box.h && Buffer.from(e.alpha, 'base64').length === e.w * e.h);
});
// every choice of the setting has a file
const app = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'apps', 'cluster_themes', 'app.json'), 'utf8'));
app.settings.filter((s) => s.key === 'emblem')[0].options.forEach((o) => ok('option ' + o[0] + ' has a file', o[0] === 'off' || fs.existsSync(path.join(dir, o[0] + '.json'))));
console.log(bad ? bad + ' FAILED' : 'emblems: all checks pass');
process.exit(bad ? 1 : 0);
