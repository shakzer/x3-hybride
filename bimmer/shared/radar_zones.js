'use strict';
/**
 * radar_zones.js - finds the danger zone nearest to a position, from the list data/radars_fr_zones.json
 * (made by tools/make_radar_zones.py out of the Ministry of the Interior's list of fixed speed cameras: zones, not cameras).
 *
 * A zone is a circle around a centre rounded to 0.01 degree: 2 km, or 4 km for a motorway zone (limit of 110 or more).
 * nearest(lat, lon) says how far the position is from the zone's EDGE (negative inside it), which is what a "danger zone
 * in 450 m" alert counts down to zero. It knows nothing about the direction of travel or the road: a zone on a road
 * running beside yours counts as well.
 *
 * NOT WIRED YET. The app has no position of the car (shared/danger.js says why); once a source gives one, its code calls
 * nearest() and feeds the alert. Not listed in any app.json "shared" until then, so nothing of this ships to the car.
 * Plain JS, no dependencies; Node 8. Written for this fork (MIT). The data is under the Licence Ouverte 2.0 (data/README.md).
 */
const fs = require('fs');

const M_PER_DEG_LAT = 110574;       // metres in a degree of latitude near France (it varies by a few tenths of a percent)
const M_PER_DEG_LON_EQ = 111320;    // metres in a degree of longitude at the equator; times cos(latitude)

class RadarZones {
    /** doc: the parsed list ({ cell, radius, radiusWide, zones: [[lat x100, lon x100, limit, wide], ...] }). */
    constructor(doc) {
        this.cell = doc.cell || 0.01;
        this.radius = doc.radius || 2000;
        this.radiusWide = doc.radiusWide || 4000;
        this.version = doc.version || '';
        this.zones = (doc.zones || []).filter((z) => Array.isArray(z) && z.length >= 4 && z.slice(0, 2).every(Number.isFinite))
            .map((z) => ({ lat: z[0] * this.cell, lon: z[1] * this.cell, limit: z[2] > 0 ? z[2] : null, wide: !!z[3] }));
        this.buckets = {};          // one per whole degree, so a lookup only looks at the 3x3 around the position
        this.zones.forEach((z) => { const k = this._key(z.lat, z.lon); (this.buckets[k] = this.buckets[k] || []).push(z); });
    }

    static load(file) { return new RadarZones(JSON.parse(fs.readFileSync(file, 'utf8'))); }

    _key(lat, lon) { return Math.floor(lat) + ',' + Math.floor(lon); }

    /** The distance in metres from (lat, lon) to a zone's centre. */
    _dist(lat, lon, z) {
        const dy = (z.lat - lat) * M_PER_DEG_LAT;
        const dx = (z.lon - lon) * M_PER_DEG_LON_EQ * Math.cos((lat + z.lat) / 2 * Math.PI / 180);
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * The zone whose edge is nearest to the position, if it is within `within` metres of the edge (default 2000; inside a
     * zone always counts): { edgeM (negative inside), centreM, inside, limit (km/h or null), wide, lat, lon (of the centre) },
     * or null (nothing near, or not a position).
     */
    nearest(lat, lon, within) {
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
        const w = within === undefined ? 2000 : within;
        const la = Math.floor(lat), lo = Math.floor(lon);
        let best = null;
        for (let a = -1; a <= 1; a++) {
            for (let b = -1; b <= 1; b++) {
                const list = this.buckets[(la + a) + ',' + (lo + b)];
                if (!list) continue;
                for (let i = 0; i < list.length; i++) {
                    const z = list[i], c = this._dist(lat, lon, z), edge = c - (z.wide ? this.radiusWide : this.radius);
                    if (edge <= w && (!best || edge < best.edgeM)) best = { edgeM: edge, centreM: c, inside: edge <= 0, limit: z.limit, wide: z.wide, lat: z.lat, lon: z.lon };
                }
            }
        }
        return best;
    }
}

module.exports = { RadarZones };
