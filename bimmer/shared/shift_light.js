'use strict';
/**
 * The stock-style shift light's state (hud.js widget "shiftlight"): how many lights are on and whether the flash is
 * in its lit half now. The orange lights fill from the outer ends in as the rpm climbs from `from` to `red` (n of them
 * each side, so 0..n), the red centre block comes on at `red` (lit = n + 1), and from `flash` everything blinks red at
 * 8 Hz. rpm not a number: nothing on.
 */
function shiftLightState(rpm, o, now) {
    if (typeof rpm !== 'number' || !isFinite(rpm)) return { lit: 0, flash: false };
    const n = o.n || 5, red = o.red, flash = Math.max(red + 100, o.flash);
    const from = Math.min(typeof o.from === 'number' ? o.from : 3000, red - 500);
    const lit = rpm >= red ? n + 1 : Math.floor(Math.max(0, (rpm - from) / (red - from)) * n);
    return { lit, flash: rpm >= flash && Math.floor(now / 62.5) % 2 === 0 };
}

module.exports = { shiftLightState };
