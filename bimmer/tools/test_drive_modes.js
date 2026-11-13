'use strict';
// The X3 30e's drive modes: each wire number or word must land in the right theme group (Hybrid / Electric / Sport)
// and carry the name the car's own screen uses. Run: node tools/test_drive_modes.js
const path = require('path');
const Module = require('module');
// shared/ loads the kit as ./kit/x; in the repo the kit lives in kit/runtime (the build copies it next to the app)
const realResolve = Module._resolveFilename;
Module._resolveFilename = function (req, parent) {
    if (/^\.\/kit\//.test(req) && parent && parent.filename && path.dirname(parent.filename) === path.join(__dirname, '..', 'shared')) {
        return realResolve.call(this, path.join(__dirname, '..', 'kit', 'runtime', req.slice(6)), parent);
    }
    return realResolve.apply(this, arguments);
};
const Hud = require('../shared/hud.js');
let bad = 0;
function eq(what, got, want) { if (got !== want) { bad++; console.log('FAIL ' + what + ': got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)); } }
const cases = [
    // [raw, group, name]
    [17, 'hybrid', 'Hybrid'], [19, 'hybrid', 'Hybrid'], [22, 'hybrid', 'Battery Control'], ['PHEV_BATTERY_CONTROL', 'hybrid', 'Battery Control'], ['Battery control', 'hybrid', 'Battery Control'],
    [20, 'eco', 'Electric'], [21, 'eco', 'Electric Individual'], [18, 'eco', 'Electric Eco Pro'],
    [15, 'sport', 'Sport'], [16, 'sport', 'Sport Individual'], [23, 'sport', 'Sport Plus'], [28, 'sport', 'Xtraboost'],
    ['PHEV_HYBRID_STANDARD', 'hybrid', 'Hybrid'], ['PHEV_ELECTRIC_STANDARD', 'eco', 'Electric'],
    ['PHEV_ELECTRIC_INDIVIDUAL', 'eco', 'Electric Individual'], ['PHEV_HYBRID_ECO', 'eco', 'Electric Eco Pro'],
    ['PHEV_SPORT_STANDARD', 'sport', 'Sport'], ['PHEV_SPORT_INDIVIDUAL', 'sport', 'Sport Individual'],
    ['PHEV_SPORT_PLUS', 'sport', 'Sport Plus'], ['BOOST', 'sport', 'Xtraboost'], ['xtraboost', 'sport', 'Xtraboost'],
    ['Electric Eco Pro', 'eco', 'Electric Eco Pro'], ['ELECTRIC ECO PRO', 'eco', 'Electric Eco Pro'],
];
cases.forEach(([raw, group, name]) => {
    eq(raw + ' group', Hud.driveModeOf(raw), group);
    eq(raw + ' name', Hud.driveNameOf(raw), name);
});
eq('unknown number', Hud.driveNameOf(999), null);
eq('unknown word', Hud.driveNameOf('???'), null);
eq('null', Hud.driveNameOf(null), null);
console.log(bad ? bad + ' FAILED' : 'drive modes: all ' + cases.length + ' cases pass');
process.exit(bad ? 1 : 0);
