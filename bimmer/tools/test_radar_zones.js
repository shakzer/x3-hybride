'use strict';
// node tools/test_radar_zones.js: the danger zone lookup (shared/radar_zones.js) and the list it reads (data/radars_fr_zones.json).
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { RadarZones } = require('../shared/radar_zones');

const M_LAT = 110574;       // metres per degree of latitude, as the module uses

// a small list: a zone near Saint-Etienne (limit 70), a motorway zone near Lyon (limit 130, wide), one with no known limit
const z = new RadarZones({
    cell: 0.01, radius: 2000, radiusWide: 4000, version: 'test',
    zones: [[4536, 425, 70, 0], [4570, 485, 130, 1], [4800, 200, 0, 0]],
});

// on the centre: inside, the limit is known
let r = z.nearest(45.36, 4.25);
assert(r && r.inside && r.edgeM < 0 && r.centreM < 1);
assert.strictEqual(r.limit, 70); assert.strictEqual(r.wide, false);
assert(Math.abs(r.edgeM + 2000) < 1, 'on the centre, the edge is one radius away');

// north of the centre: the edge is the distance minus the radius, 1.5 km from the centre is still inside
r = z.nearest(45.36 + 1500 / M_LAT, 4.25);
assert(r.inside && Math.abs(r.edgeM + 500) < 5, 'edgeM ' + r.edgeM);
// 2.8 km north: 800 m before the zone
r = z.nearest(45.36 + 2800 / M_LAT, 4.25);
assert(!r.inside && Math.abs(r.edgeM - 800) < 5, 'edgeM ' + r.edgeM);
// 4.5 km north: not within the default 2 km, but within 3 km
assert.strictEqual(z.nearest(45.36 + 4500 / M_LAT, 4.25), null);
assert(Math.abs(z.nearest(45.36 + 4500 / M_LAT, 4.25, 3000).edgeM - 2500) < 5);
// east: a degree of longitude is shorter at this latitude (cos 45.36 deg), 2.8 km east is 0.0357 degrees
const dLon = 2800 / (111320 * Math.cos(45.36 * Math.PI / 180));
assert(Math.abs(z.nearest(45.36, 4.25 + dLon).edgeM - 800) < 8);

// the wide zone is 4 km
r = z.nearest(45.70 + 3000 / M_LAT, 4.85);
assert(r.inside && r.wide && r.limit === 130 && Math.abs(r.edgeM + 1000) < 5);
// no known limit -> null, not 0
assert.strictEqual(z.nearest(48.0, 2.0).limit, null);

// the nearest edge wins when two are near, and the deeper one when inside both
const two = new RadarZones({ zones: [[4500, 400, 50, 0], [4500, 404, 90, 0]] });     // 0.04 degree apart, about 3.1 km
r = two.nearest(45.0, 4.0 + 0.01);
assert.strictEqual(r.limit, 50, 'the one it is deeper in');
r = two.nearest(45.0, 4.0 + 0.03);
assert.strictEqual(r.limit, 90);

// far from everything, and not a position
assert.strictEqual(z.nearest(0, 0), null);
assert.strictEqual(z.nearest(NaN, 4), null);
assert.strictEqual(z.nearest(95, 4), null);
assert.strictEqual(z.nearest(45, 200), null);
assert.strictEqual(new RadarZones({}).nearest(45, 4), null);
// a bad entry in the list is skipped
assert.strictEqual(new RadarZones({ zones: [[1], 'x', null, [4536, 425, 70, 0]] }).zones.length, 1);

// the real list
const file = path.join(__dirname, '..', 'data', 'radars_fr_zones.json');
const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
assert(/Licence Ouverte/.test(doc.licence) && /Intérieur/.test(doc.source) && doc.version, 'source, licence and version are written in it');
assert(doc.zones.length > 2500 && doc.zones.length < 3400, 'about three thousand zones: ' + doc.zones.length);
assert(doc.zones.every((q) => q.length === 4 && q.every(Number.isInteger)), 'whole numbers only: a centre is on the 0.01 degree grid, never an exact position');
assert(doc.zones.every((q) => (q[3] === 1) === (q[2] >= 110)), 'a wide zone is a limit of 110 or more');
assert(doc.zones.every((q) => q[2] === 0 || (q[2] >= 20 && q[2] <= 130)), 'limits are 0 or 20..130');
assert(!/"type"|ETF|ETT|ETD|ETU|ETVM|ETFR|ETPN/.test(JSON.stringify(doc)), 'no camera type in it');
const real = RadarZones.load(file);
assert.strictEqual(real.zones.length, doc.zones.length);
// metropolitan France is dotted with them: a point in the Atlantic is not
assert.strictEqual(real.nearest(45.0, -20.0, 10000), null);
// every real zone finds itself, and quickly: the whole list in well under a second
const t0 = Date.now();
real.zones.forEach((q) => { const n = real.nearest(q.lat, q.lon); assert(n && n.inside, 'a zone is inside itself'); });
assert(Date.now() - t0 < 2000, 'the lookup of every zone took ' + (Date.now() - t0) + ' ms');
console.log('radar zones: ok (' + doc.zones.length + ' zones, version ' + doc.version + ')');
