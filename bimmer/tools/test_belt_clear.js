'use strict';
// BMW draws its seat-belt warning light (and a black box round it) over the cluster at visible.BELT. A theme that draws
// anything there shows black pixels round the light, so no text, icon or emblem of a cluster layout may sit in it, and
// the Sport theme's bottom strip (drawn in the sdash shader) must end above it.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const visible = require('../shared/visible');

const BELT = visible.BELT || [587, 663, 626, 700];
const dir = path.join(__dirname, '..', 'apps', 'cluster_themes', 'hud', 'layouts');
const hits = [];
let n = 0;
fs.readdirSync(dir).filter((f) => /\.json$/.test(f)).forEach((f) => {
    const L = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (L.target === 'hud' || !L.widgets) return;
    (L.widgets || []).forEach((w) => {
        if (typeof w.x !== 'number' || w.w > 1500) return;                  // (a backdrop over the whole panel: BMW's light draws over it)
        if (!/^(text|icon|emblem|badge|atext)$/.test(w.type)) return;
        n++;
        if (w.x < BELT[2] && w.x + w.w > BELT[0] && w.y < BELT[3] && w.y + w.h > BELT[1]) hits.push(f + ': ' + w.id);
    });
    const dash = (L.widgets || []).find((w) => w.type === 'sdash' && w.strip);
    if (dash) {
        const s = dash.strip;       // [left end x, top y, height, slant]
        assert(s[1] + s[2] <= BELT[1] - 3, f + ': the bottom strip ends at y ' + (s[1] + s[2]) + ', over the seat-belt light (y ' + BELT[1] + ')');
    }
});
assert.deepStrictEqual(hits, [], 'in the seat-belt light\'s box: ' + hits.join(', '));
console.log('belt clear: ' + n + ' texts, icons and emblems checked, none in the seat-belt light\'s box; the Sport strip ends above it');
