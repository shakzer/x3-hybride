'use strict';
/**
 * danger.js - the "danger zone" alert of Cluster Themes (M Blade and Navi draw it in Waze's style: a camera, the
 * distance and, when known, the speed limit).
 *
 * This app knows no position and no map data (the CarPlay link carries the picture of Waze's map, nothing else),
 * so it has no way to find a danger zone itself. Whatever can (an app that reads the car's navigation, one that reads
 * Waze's picture) says so through a file, the same hand-over as the centre window (cluster_info.js):
 *
 *   /dev/shm/cluster-themes/danger-<source>.json   { "t": <ms since 1970, now>, "app": "<source>", "distance": <metres>,
 *                                                    "limit": <km/h, optional> }
 *
 * The source rewrites it while a zone is ahead (about once a second; replace the file whole: write a temporary file,
 * then rename it); the alert shows while one is fresh (under STALE_MS old) and goes when the file stops, is older, or
 * is removed. The nearest zone wins when several sources write. Nothing says what kind of device it is, and nothing
 * here keeps a list of zones: the wording is "danger zone", with a distance, as the law allows.
 *
 * The alert is off until the setting "dangerAlert" is on (hud.js). Never throws; Node 8. Written for this fork (MIT).
 */
const fs = require('fs');

const THEMES_DIR = process.env.CLUSTER_THEMES_DIR || '/dev/shm/cluster-themes';
const STALE_MS = 3000;          // a source's file older than this counts as gone
const SCAN_MS = 500;
const MAX_M = 20000;            // a distance past this is not a zone ahead (a bad value)

class Danger {
    /** opts: { dir, now }; onChange() is called when the alert comes or goes, or when whether a limit is known changes. */
    constructor(opts, log, onChange) {
        opts = opts || {};
        this.dir = opts.dir || THEMES_DIR;
        this.now = opts.now || Date.now;
        this.log = log;
        this.onChange = onChange || (() => {});
        this.timer = null;
        this.cur = null;                 // { distance, limit, app } while an alert is on
    }

    start() {
        this.stop();
        this.timer = setInterval(() => this.scan(), SCAN_MS);
        if (this.timer.unref) this.timer.unref();
        this.scan();
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    /** The alert now: { on, distM, limit (km/h or null), app }. */
    state() {
        const c = this.cur;
        return c ? { on: true, distM: c.distance, limit: c.limit, app: c.app } : { on: false, distM: null, limit: null, app: '' };
    }

    /** Reads the sources' files once: the nearest fresh zone becomes the alert. */
    scan() {
        let best = null;
        try {
            const t = this.now();
            let names = [];
            try { names = fs.readdirSync(this.dir); } catch (e) { names = []; }
            names.forEach((n) => {
                if (!/^danger-[\w.-]+\.json$/.test(n)) return;
                let j = null;
                try { j = JSON.parse(fs.readFileSync(this.dir + '/' + n, 'utf8')); } catch (e) { return; }
                if (!j || typeof j.t !== 'number' || t - j.t >= STALE_MS || j.t - t > STALE_MS) return;
                if (typeof j.distance !== 'number' || !isFinite(j.distance) || j.distance < 0 || j.distance > MAX_M) return;
                const limit = typeof j.limit === 'number' && isFinite(j.limit) && j.limit >= 5 && j.limit <= 200 ? Math.round(j.limit) : null;
                if (!best || j.distance < best.distance) best = { distance: j.distance, limit, app: typeof j.app === 'string' ? j.app.slice(0, 30) : n };
            });
        } catch (e) { best = null; }
        const before = this.cur;
        this.cur = best;
        const flipped = !!before !== !!best || (before && best && (before.limit === null) !== (best.limit === null));
        if (flipped) {
            if (best && !before) this.log.info('danger zone alert on (' + best.app + ', ' + Math.round(best.distance) + ' m)');
            else if (!best) this.log.info('danger zone alert off');
            try { this.onChange(); } catch (e) { this.log.warn('danger: ' + e.message); }
        }
    }
}

/** The distance as the alert shows it: { n: "350", unit: "m" } (metric: m under a kilometre, km with a decimal; US: ft, then mi). */
function formatDistance(metres, us) {
    if (typeof metres !== 'number' || !isFinite(metres)) return { n: '--', unit: us ? 'mi' : 'km' };
    if (us) {
        const ft = Math.max(50, Math.round(metres * 3.28084 / 50) * 50);
        if (ft < 1000) return { n: String(ft), unit: 'ft' };
        return { n: (metres / 1609.344).toFixed(1), unit: 'mi' };
    }
    const m = Math.max(10, Math.round(metres / 10) * 10);
    if (m < 1000) return { n: String(m), unit: 'm' };
    return { n: (metres / 1000).toFixed(1), unit: 'km' };
}

/** The speed limit in the display unit (the source gives km/h): "50", or in mph rounded to 5. '' for none. */
function formatLimit(kmh, us) {
    if (typeof kmh !== 'number' || !isFinite(kmh)) return '';
    return String(us ? Math.round(kmh * 0.621371 / 5) * 5 : Math.round(kmh));
}

module.exports = { Danger, formatDistance, formatLimit, THEMES_DIR, STALE_MS };
