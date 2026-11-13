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
 *     /dev/shm/cluster-themes/themes.json ({ at }) while a theme shows; Cluster Centre's pages would be hidden under it.
 * Read-only, tolerant: a missing, unreadable or old file means "not showing". The status file counts for STALE_MS
 * after it was last written (the service writes it every second), so a service that died while "showing" does not
 * keep the centre blank. Plain Node 8.
 */
const fs = require('fs');

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

module.exports = { wazeShowing, themeShowing, WAZE_STATUS, THEMES_FILE };
