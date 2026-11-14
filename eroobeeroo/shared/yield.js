'use strict';
/**
 * yield.js - when Cluster Centre should step aside (x3-hybride: added to eroobeeroo's Cluster Centre).
 *
 * The centre of the factory cluster (slot 0x100) has one owner at a time:
 *   - Waze on cluster (robertnisipeanu/idrive-apps) draws the phone's Waze map there while it shows. Its render writes
 *     /run/waze-on-cluster/status.json once a second ({ state: idle|starting|showing|frozen|error|off|unsupported,
 *     cluster: 1|0, ... }); Cluster Centre leaves the map alone while state is "showing" with the map on the cluster,
 *     and takes the centre back when the map goes (the pages then show the car's data again).
 *   - Cluster Themes (bimmer-lab, as built in x3-hybride) redraws the whole panel. It touches
 *     /dev/shm/cluster-themes/themes.json ({ at, window, open }) while a theme shows; Cluster Centre's pages would be
 *     hidden under it. GT3, Sport and M leave a see-through window in the middle (where Waze's map shows): Cluster Centre
 *     asks for it (window-cluster_centre.json beside themes.json), the theme opens it ("open") and "window" is its
 *     rectangle on the panel; the pages are drawn in the slot under it, shrunk to its size.
 * Read-only, tolerant: a missing, unreadable or old file means "not showing". The status file counts for STALE_MS
 * after it was last written (the service writes it every second), so a service that died while "showing" does not
 * keep the centre blank. Plain Node 8.
 */
const fs = require('fs');
const path = require('path');

const WAZE_STATUS = process.env.WAZE_STATUS_FILE || '/run/waze-on-cluster/status.json';
const THEMES_FILE = process.env.CLUSTER_THEMES_FILE || '/dev/shm/cluster-themes/themes.json';
const STALE_MS = 5000;
const READ_EVERY_MS = 500;

const cache = {};
/** The JSON in `file` and its age in ms (mtime), re-read at most every READ_EVERY_MS; null when not there. */
function read(file, now) {
    const c = cache[file];
    if (c && now - c.read < READ_EVERY_MS) return c.v;
    let v = null;
    try {
        const age = now - fs.statSync(file).mtimeMs;
        const j = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (j && typeof j === 'object') v = { j, age };
    } catch (e) { /* not there, or half written: not showing */ }
    cache[file] = { read: now, v };
    return v;
}

/** True while Waze on cluster shows its map on the cluster. */
function wazeShowing(now) {
    const s = read(WAZE_STATUS, now || Date.now());
    return !!s && s.age < STALE_MS && s.j.state === 'showing' && s.j.cluster !== 0 && s.j.cluster !== false;
}

/** True while a Cluster Themes theme is on the panel (its marker was written in the last few seconds). */
function themeShowing(now) {
    const t = now || Date.now(), s = read(THEMES_FILE, t);
    return !!s && typeof s.j.at === 'number' && t - s.j.at < 3000;
}

const THEMES_DIR = path.dirname(THEMES_FILE);
// the centre slot (the Waze map's 1088x480) sits in the middle of the 1920x720 panel
const SLOT = { x: 416, y: 120, w: 1088, h: 480 };
const num = (v) => typeof v === 'number' && isFinite(v);

/**
 * The theme's centre window while it is open (see-through) for the apps: { x, y, w, h } on the panel, or null (no
 * theme, no window in this one, or not open now).
 */
function themeWindow(now) {
    const t = now || Date.now(), s = read(THEMES_FILE, t);
    if (!s || typeof s.j.at !== 'number' || t - s.j.at >= 3000 || s.j.open !== true) return null;
    const w = s.j.window;
    return w && num(w.x) && num(w.y) && num(w.w) && num(w.h) && w.w > 0 && w.h > 0 ? { x: w.x, y: w.y, w: w.w, h: w.h } : null;
}

/** The window as the centre slot sees it (the slot's own pixels), or null. */
function slotWindow(now) {
    const w = themeWindow(now);
    return w ? { x: w.x - SLOT.x, y: w.y - SLOT.y, w: w.w, h: w.h } : null;
}

const HUD_LAYOUT_FILE = process.env.CLUSTER_HUD_LAYOUT_FILE || path.join(THEMES_DIR, 'hud-layout.json');
/**
 * Where HUD Widgets' layout leaves room for Cluster Info's panel (hud-layout.json beside themes.json): { x, y, w, h } on
 * the HUD, null when the layout leaves none, undefined when HUD Widgets shows no layout now (BMW's own HUD).
 */
function hudPanel(now) {
    const t = now || Date.now(), s = read(HUD_LAYOUT_FILE, t);
    if (!s || typeof s.j.at !== 'number' || t - s.j.at >= 3000) return undefined;
    const p = s.j.panel;
    return p && num(p.x) && num(p.y) && num(p.w) && num(p.h) && p.w > 0 && p.h > 0 ? { x: p.x, y: p.y, w: p.w, h: p.h } : null;
}

/**
 * Ask the theme to open its centre window (at most once a second): window-<app>.json beside themes.json, { t, app,
 * kind, showing } with what this app draws in it. Only while the theme's folder is there (a theme made it): without
 * a theme there is nothing to ask. Never throws.
 */
const asked = {};
function requestWindow(app, extra, now) {
    const t = now || Date.now();
    if (t - (asked[app] || 0) < 1000) return;
    try {
        if (!fs.statSync(THEMES_DIR).isDirectory()) return;
        asked[app] = t;
        const f = path.join(THEMES_DIR, 'window-' + app + '.json'), tmp = f + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(Object.assign({}, extra, { t, app })), { mode: 0o644 });
        fs.renameSync(tmp, f);
    } catch (e) { /* no theme folder, or not writable: nothing to ask */ }
}

/** Stop asking (the file goes). */
function withdrawWindow(app) {
    if (!asked[app]) return;
    asked[app] = 0;
    try { fs.unlinkSync(path.join(THEMES_DIR, 'window-' + app + '.json')); } catch (e) { /* gone */ }
}

/** True while another app draws its pages in the theme's window ({ kind: 'pages', showing: true }, fresh). */
const winSeen = { read: 0, v: false };
function pagesInWindow(now) {
    const t = now || Date.now();
    if (t - winSeen.read < READ_EVERY_MS) return winSeen.v;
    winSeen.read = t;
    let v = false;
    try {
        fs.readdirSync(THEMES_DIR).forEach((n) => {
            if (v || !/^window-[\w.-]+\.json$/.test(n)) return;
            try {
                const j = JSON.parse(fs.readFileSync(path.join(THEMES_DIR, n), 'utf8'));
                if (j && j.kind === 'pages' && j.showing === true && num(j.t) && t - j.t < STALE_MS) v = true;
            } catch (e) { /* half written */ }
        });
    } catch (e) { /* no folder */ }
    winSeen.v = v;
    return v;
}

module.exports = { wazeShowing, themeShowing, themeWindow, slotWindow, hudPanel, requestWindow, withdrawWindow, pagesInWindow, WAZE_STATUS, THEMES_FILE, THEMES_DIR, SLOT };
