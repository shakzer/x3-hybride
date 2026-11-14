'use strict';
/**
 * cluster_info.js - the hand-over with eroobeeroo's Cluster Info / Cluster Centre / Cluster Layouts
 * (eroobeeroo/idrive7-cluster-info), through the files they share in /dev/shm/cluster-info:
 *
 *  - gives them the plug-in hybrid's battery charge: writes <app id>.json there ({ v: 1, t, app, values: { soc:
 *    { pct } } }, the format Cluster Info's providers.js documents) while this app has a fresh reading, a few
 *    times a second, replacing the file whole (temporary file, then rename). They show it as "SOC" / the charge, and
 *    Cluster Centre's eDrive page estimates the electric range from it;
 *  - reads what they want (wanted*.json: Cluster Info writes wanted.json while its panel is up, Cluster Centre its
 *    own wanted-<app>.json): while one of them asks for "soc" (or the electric range) this app reads the battery
 *    unit even if its own layout doesn't show the charge, so the panel over the Waze map has it;
 *  - takes the charge from another app that shares it (eDrive Live reads the battery unit itself, a second reader
 *    is avoided: "leave the battery unit to it"): the first other provider's values.soc.pct, while fresh;
 *  - says when a cluster theme shows (/dev/shm/cluster-themes/themes.json, { at, window, open }, written once a
 *    second): a theme covers the whole panel, so Cluster Centre and Cluster Info draw in its centre window instead
 *    (the window where Waze's map shows: "window" is its rectangle on the panel, "open" that it is see-through now);
 *  - HUD Widgets says where its layout leaves room on the HUD (/dev/shm/cluster-themes/hud-layout.json, { at, panel }):
 *    Cluster Info's panel goes there instead of on the readouts;
 *  - reads who wants that window: each of them writes /dev/shm/cluster-themes/window-<app>.json ({ t, app, kind,
 *    showing }) while it does, and the theme opens the window while one is fresh (wantsWindow()).
 *
 * Never throws: every file operation is guarded, a folder that can't be written is logged once. Node 8 (no
 * recursive mkdir). Written for this fork (MIT, as the rest of bimmer-lab's shared/).
 */
const fs = require('fs');
const path = require('path');

const INFO_DIR = process.env.CLUSTER_INFO_DIR || '/dev/shm/cluster-info';
const THEMES_DIR = process.env.CLUSTER_THEMES_DIR || '/dev/shm/cluster-themes';
const STALE_MS = 3000;          // a provider's file older than this counts as gone (Cluster Info's rule)
const WRITE_MS = 500;           // our file is replaced at most this often
const SCAN_MS = 500;

class ClusterInfo {
    /** opts: { id: the app's id (the file's name), name: the app's title, dir, themesDir }. */
    constructor(opts, log) {
        opts = opts || {};
        this.id = opts.id || 'cluster_themes';
        this.name = opts.name || this.id;
        this.dir = opts.dir || INFO_DIR;
        this.themesDir = opts.themesDir || THEMES_DIR;
        this.log = log;
        this.others = {};           // id -> parsed provider file (not ours)
        this.want = {};             // what the apps that asked want: { soc: true, ... }
        this.written = 0;
        this.warned = {};
        this.timer = null;
        this.themeAt = 0;
        this.themeKey = '';
        this.windowAsk = false;     // an app asks for the centre window now
        this.now = opts.now || Date.now;
    }

    start() {
        this.timer = setInterval(() => this.scan(), SCAN_MS);
        this.scan();
    }

    stop() {
        clearInterval(this.timer);
        this.release();
    }

    _warn(what, e) {
        if (this.warned[what]) return;
        this.warned[what] = true;
        this.log.info('cluster info: ' + what + ': ' + (e && e.message || e));
    }

    _ensure(dir) {
        try {
            try { fs.mkdirSync(dir); } catch (e) { if (e.code !== 'EEXIST') throw e; }
            try { fs.chmodSync(dir, 0o1777); } catch (e) { /* not ours: fine, as long as it can be written */ }
            return true;
        } catch (e) { this._warn(dir, e); return false; }
    }

    /** Read the other providers and what is wanted. */
    scan() {
        this._scanWindow();
        let names = [];
        try { names = fs.readdirSync(this.dir); } catch (e) { this.others = {}; this.want = {}; return; }
        const others = {}, want = {};
        const t = this.now();
        names.forEach((n) => {
            if (!/\.json$/.test(n)) return;
            let j;
            try { j = JSON.parse(fs.readFileSync(path.join(this.dir, n), 'utf8')); } catch (e) { return; }   // half written: next scan
            if (!j || typeof j.t !== 'number' || t - j.t >= STALE_MS) return;
            if (/^wanted(-[\w.-]+)?\.json$/.test(n)) {
                (Array.isArray(j.values) ? j.values : []).forEach((v) => { want[v] = true; });
            } else if (n !== this.id + '.json') others[n.replace(/\.json$/, '')] = j;
        });
        this.others = others; this.want = want;
    }

    /** Whether an app asks for the centre window: a fresh window-<app>.json in the themes folder (not our own). */
    _scanWindow() {
        let names = [];
        try { names = fs.readdirSync(this.themesDir); } catch (e) { this.windowAsk = false; return; }
        const t = this.now();
        let ask = false;
        names.forEach((n) => {
            if (!/^window-[\w.-]+\.json$/.test(n) || n === 'window-' + this.id + '.json') return;
            let j;
            try { j = JSON.parse(fs.readFileSync(path.join(this.themesDir, n), 'utf8')); } catch (e) { return; }   // half written: next scan
            if (j && typeof j.t === 'number' && t - j.t < STALE_MS) ask = true;
        });
        this.windowAsk = ask;
    }

    /** True while Cluster Centre or Cluster Info ask the theme to open its centre window. */
    wantsWindow() {
        return this.windowAsk === true;
    }

    /** True while Cluster Info / Cluster Centre ask for the battery charge or the electric range. */
    wantsBattery() {
        return !!(this.want.soc || this.want.evRange || this.want.erange);
    }

    /** The charge in % that another app shares (eDrive Live), or null. */
    sharedSoc() {
        for (const id of Object.keys(this.others).sort()) {
            const v = this.others[id].values && this.others[id].values.soc;
            if (v && typeof v.pct === 'number' && isFinite(v.pct) && v.pct >= 0 && v.pct <= 100) return v.pct;
        }
        return null;
    }

    /** Share the charge (% or null for none now): replaces our file at most every WRITE_MS, removes it when there is none. */
    publish(socPct) {
        const t = this.now();
        if (typeof socPct !== 'number' || !isFinite(socPct)) return this.release();
        if (t - this.written < WRITE_MS || !this._ensure(this.dir)) return;
        this.written = t;
        const f = path.join(this.dir, this.id + '.json'), tmp = f + '.tmp';
        try {
            fs.writeFileSync(tmp, JSON.stringify({ v: 1, t, app: this.name, values: { soc: { pct: Math.round(socPct * 10) / 10 } } }), { mode: 0o644 });
            fs.renameSync(tmp, f);
            this.has = true;
        } catch (e) { this._warn('write', e); }
    }

    /** Stop sharing (the file goes: a consumer would use a stale one for 3 s only, but there is no reason to leave it). */
    release() {
        if (!this.has) return;
        this.has = false;
        try { fs.unlinkSync(path.join(this.dir, this.id + '.json')); } catch (e) { /* gone */ }
    }

    /**
     * HUD Widgets: say where its layout leaves room for Cluster Info's panel (hud-layout.json beside themes.json), on the
     * HUD's pixels: { x, y, w, h }, or null when the layout leaves none. showing false removes the file (BMW's own HUD:
     * Cluster Info then sits where it always did).
     */
    markLayout(showing, panel) {
        const t = this.now();
        if (!showing) {
            this.layoutKey = '';
            if (this.layoutMarked) { this.layoutMarked = false; try { fs.unlinkSync(path.join(this.themesDir, 'hud-layout.json')); } catch (e) { /* gone */ } }
            return;
        }
        const p = panel && ['x', 'y', 'w', 'h'].every((k) => typeof panel[k] === 'number' && isFinite(panel[k])) ? { x: panel.x, y: panel.y, w: panel.w, h: panel.h } : null;
        const key = JSON.stringify(p);
        if ((t - (this.layoutAt || 0) < 1000 && key === this.layoutKey) || !this._ensure(this.themesDir)) return;
        this.layoutAt = t; this.layoutKey = key;
        const f = path.join(this.themesDir, 'hud-layout.json'), tmp = f + '.tmp';
        try { fs.writeFileSync(tmp, JSON.stringify({ at: t, app: this.name, panel: p }), { mode: 0o644 }); fs.renameSync(tmp, f); this.layoutMarked = true; } catch (e) { this._warn('hud layout', e); }
    }

    /**
     * Say a cluster theme shows now (at most once a second, at once when `info` changes); Cluster Centre and Cluster
     * Info look for it. info: { window: { x, y, w, h } | null, open: bool } - the centre window on the panel (null: this
     * theme has none) and whether it is see-through now.
     */
    markTheme(showing, info) {
        const t = this.now();
        if (!showing) {
            this.themeKey = '';
            if (this.themeMarked) { this.themeMarked = false; try { fs.unlinkSync(path.join(this.themesDir, 'themes.json')); } catch (e) { /* gone */ } }
            return;
        }
        const win = info && info.window && ['x', 'y', 'w', 'h'].every((k) => typeof info.window[k] === 'number' && isFinite(info.window[k]))
            ? { x: info.window.x, y: info.window.y, w: info.window.w, h: info.window.h } : null;
        const open = !!(win && info && info.open === true);
        const key = JSON.stringify([win, open]);
        if ((t - this.themeAt < 1000 && key === this.themeKey) || !this._ensure(this.themesDir)) return;
        this.themeAt = t; this.themeKey = key;
        const f = path.join(this.themesDir, 'themes.json'), tmp = f + '.tmp';
        try { fs.writeFileSync(tmp, JSON.stringify({ at: t, app: this.name, window: win, open }), { mode: 0o644 }); fs.renameSync(tmp, f); this.themeMarked = true; } catch (e) { this._warn('presence', e); }
    }
}

module.exports = { ClusterInfo, INFO_DIR, THEMES_DIR, STALE_MS };
