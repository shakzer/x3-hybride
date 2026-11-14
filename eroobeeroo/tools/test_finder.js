'use strict';
/**
 * test_finder.js - signal_finder.js against a small catalog in the head unit's format: range, fuel and
 * charge fields are found (by their own name or a member's), ranked range first, other fields left out.
 *   node tools/test_finder.js
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findSignals } = require('../apps/cluster_layouts/signal_finder');

const cat = {
    datatypes: {
        RangeStruct: { type: 'struct', members: [{ name: 'remainingRangeElectric', dataRef: 'u16' }, { name: 'remainingRangeFuel', dataRef: 'u16' }] },
        SpeedStruct: { type: 'struct', members: [{ name: 'speedVehicle', dataRef: 'u16' }] },
        Base: { type: 'struct', members: [{ name: 'qualifier', dataRef: 'u8' }] },
        TankStruct: { type: 'struct', extends: 'Base', members: [{ name: 'fuelLevel', dataRef: 'u8' }] },
    },
    interfaces: {
        'de.bmw.infotainment.vehicle.Example': { serviceId: 1, fields: {
            statusRange: { dataRef: 'RangeStruct', getter: { id: 3 }, notifier: { id: 4 } },
            statusTank: { dataRef: 'TankStruct', notifier: { id: 5 } },
            statusSpeed: { dataRef: 'SpeedStruct', notifier: { id: 6 } },
        } },
        'com.other.Thing': { fields: { statusRange: { dataRef: 'RangeStruct' } } },
    },
};
const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cat-')), 'someip-interfaces.json');
fs.writeFileSync(f, JSON.stringify(cat));
const r = findSignals({ path: f });
assert.strictEqual(r.error, null);
assert.deepStrictEqual(r.list.map((s) => s.field), ['statusRange', 'statusTank']);
assert(r.list[0].get && r.list[0].notify && r.list[0].members.indexOf('remainingRangeFuel') >= 0);
assert.deepStrictEqual(r.list[1].members, ['qualifier', 'fuelLevel']);   // its own name matches: all its members
assert(findSignals({ path: f + '.none' }).error);
console.log('ok   ranges, fuel and charge found, others left out; a missing catalog says so');

// x3-hybride: a whole interface by name (the cluster's), capped; its fields come after the ones whose own name matches
cat.interfaces['de.bmw.infotainment.KombiIF'] = { serviceId: 9, fields: {
    statusBordcomputerTravelData: { dataRef: 'SpeedStruct', getter: { id: 1 }, notifier: { id: 2 } },
    statusSomethingElse: { dataRef: 'Base', notifier: { id: 3 } },
    statusMore: { dataRef: 'Base', notifier: { id: 4 } },
} };
fs.writeFileSync(f, JSON.stringify(cat));
const k = findSignals({ path: f, match: /bordcomputer/i, iface: /kombi/i });
assert.deepStrictEqual(k.list.map((s) => s.field), ['statusBordcomputerTravelData', 'statusMore', 'statusSomethingElse']);
assert.deepStrictEqual(k.list[1].members, ['qualifier'], 'every field of the interface, with its members');
assert.strictEqual(findSignals({ path: f, match: /bordcomputer/i, iface: /kombi/i, max: 2 }).list.length, 2);
assert.strictEqual(findSignals({ path: f, match: /bordcomputer/i }).list.length, 1, 'without iface: the name match only');
console.log('ok   a whole interface by name, capped');
