'use strict';
/**
 * emblems.js - an emblem image widget ("type": "emblem"): lettering baked on the Mac (tools/bake_emblems.py, hud/emblems/<name>.json:
 * { w, h, alpha } one byte of coverage a pixel) and painted here in a gradient of the M theme's colours (light blue, dark blue, red),
 * left to right across the ink, centred in the widget's box. Our own lettering, not a brand's logo.
 */
const { M_STRIPE } = require('./hud_themes');
// The M theme's own three colours (hud_themes M_STRIPE): light blue fading to dark blue, then a short blend into red.
// Blending dark blue into red slowly goes through purple and pink, so that step is kept short.
const rgb = (c) => [c[0], c[1], c[2]];
const STOPS = [[0, rgb(M_STRIPE[0])], [0.10, rgb(M_STRIPE[0])], [0.40, rgb(M_STRIPE[1])], [0.56, rgb(M_STRIPE[1])], [0.64, rgb(M_STRIPE[2])], [1, rgb(M_STRIPE[2])]];

function at(stops, t) {
    for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i], b = stops[i + 1];
        if (t <= b[0] || i === stops.length - 2) {
            const u = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0] || 1)));
            return [0, 1, 2].map((k) => Math.round(a[1][k] + (b[1][k] - a[1][k]) * u));
        }
    }
    return stops[0][1];
}

/** RGBA (straight) for a w x h box; `mask` is the baked { w, h, alpha (base64) }; a missing mask gives a clear box. */
function paintEmblem(mask, w, h, stops) {
    const out = Buffer.alloc(w * h * 4, 0);
    if (!mask || !mask.alpha || !mask.w || !mask.h || mask.w > w || mask.h > h) return out;
    const a = Buffer.from(mask.alpha, 'base64'), ox = Math.floor((w - mask.w) / 2), oy = Math.floor((h - mask.h) / 2);
    const ramp = [];
    for (let x = 0; x < mask.w; x++) ramp.push(at(stops || STOPS, mask.w > 1 ? x / (mask.w - 1) : 0));
    for (let y = 0; y < mask.h; y++) {
        for (let x = 0; x < mask.w; x++) {
            const v = a[y * mask.w + x];
            if (!v) continue;
            const o = ((oy + y) * w + ox + x) * 4, c = ramp[x];
            out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = v;
        }
    }
    return out;
}

module.exports = { paintEmblem, STOPS };
