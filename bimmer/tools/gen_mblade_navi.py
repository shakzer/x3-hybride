#!/usr/bin/env python3
"""Writes apps/cluster_themes/hud/layouts/mblade.json and navi.json (the M Blade and Navi cluster themes).

Both are traced off a photo of a BMW cluster (Nov 14 2026): positions measured on an enlarged copy, mapped to the X3's
1920x720 panel by two anchors (BMW's seat-belt light at x 606, y 681; the map slot 416,120 1088x480), then kept clear of the
car's own zones (hood, the black box at x 1406..1597 y 342..419, the belt light at x 587..626 y 663..700, the map slot).
Edit this and run it again; the shaders (shared/shaders.js mblade, navi) take their geometry from the "backdrop" widget.
Usage: python3 tools/gen_mblade_navi.py   (from the app's root)
"""
import json, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'apps', 'cluster_themes', 'hud', 'layouts')


def text(id, x, y, w, h, t, font, color='fg', align=None, conn=0, **kw):
    d = {'id': id, 'type': 'text', 'z': 5, 'x': x, 'y': y, 'w': w, 'h': h, 'text': t, 'font': font, 'color': color}
    if align:
        d['align'] = align
    if conn:
        d['conn'] = conn
    d.update(kw)
    return d


def icon(id, name, x, y, w, h, color='dim', conn=0):
    d = {'id': id, 'type': 'icon', 'icon': name, 'z': 5, 'x': x, 'y': y, 'w': w, 'h': h, 'color': color}
    if conn:
        d['conn'] = conn
    return d


def shiftlight(x, y):
    return {'id': 'shiftlight', 'type': 'shiftlight', 'z': 3, 'x': x, 'y': y, 'w': 420, 'h': 56, 'segments': 5, 'from': 3000,
            'red': 4500, 'flash': 5500, 'gap': 11, 'center': 72, 'toggle': 'stockShiftLight'}


def emblem(x, y):
    # the lettering sits above the map window, so it stays while the window is open
    return {'id': 'emblem', 'type': 'emblem', 'setting': 'emblem', 'keepWithMap': True, 'z': 5, 'x': x, 'y': y, 'w': 360, 'h': 96}


# ------------------------------------------------------------------------------------------------ M Blade
def mblade():
    W = []
    W.append({
        'id': 'backdrop', 'type': 'mblade', 'class': 'content', 'z': 1, 'x': 0, 'y': 0, 'w': 1920, 'h': 720,
        'card': [116, 149, 592, 34], 'cardB': [909, 1002, 322, 863],
        'plate': [301, 386, 661, 606], 'plateRight': 919,
        'stripe1': [375, 188, 196, 456], 'stripe2': [528, 218, 372, 441], 'stripeW': [92, 54],
        'bl': [105, 609, 1178, -0.6], 'br': [1347, -0.643, 1037, 707], 'scale': [135, 610], 'rpmMax': 7000,
        'g0': [1371, 422, 1260, 601], 'g1': [1532, 422, 1428, 601],
        'hole': [440, 168, 470, 290], 'holeWhen': 'mapUp', 'holeInset': 8, 'holeRadius': 22,
    })
    W.append(shiftlight(750, 32))          # where BMW's own shift light sits (x 750..1170), as on the M and Sport themes
    W.append(emblem(410, 36))              # the lettering, left of it (the ink is 132 px wide, centred in the 360 px box)
    # gear and speed on the plate; under the map window while it is open
    W.append(text('gear', 700, 285, 240, 117, '{{gear}}', 'm_gear', align='center', toggle='!mapUp'))
    W.append(text('speed', 700, 400, 240, 82, '{{speed}}', 'm_speed', align='center', toggle='!mapUp'))
    W.append(text('speed_unit', 700, 480, 240, 29, '{{u:speedLc}}', 'm_tiny', 'dim', 'center', toggle='!mapUp'))
    W.append(text('mgear', 440, 474, 200, 117, '{{gear}}', 'm_gear', align='center', toggle='mapUp'))
    W.append(text('mspeed', 640, 468, 230, 82, '{{speed}}', 'm_speed', align='right', toggle='mapUp'))
    W.append(text('mspeed_unit', 640, 552, 230, 29, '{{u:speedLc}}', 'm_tiny', 'dim', 'right', toggle='mapUp'))
    # rev blade labels (0..7) just right of its right edge, "1/min x1000" above it
    for k in range(8):
        y = 610 - k * (610 - 135) / 7.0
        xr = 1347 - 0.643 * (y - 105)
        W.append(text('n%d' % k, round(xr + 42 - 30), round(y - 19), 60, 38, str(k), 'm_num', align='center', conn=1))
    W.append(text('rpm_unit', 1240, 64, 228, 29, '1/min x1000', 'm_tiny', 'faint', conn=1))
    # battery gauge (g0) and fuel gauge (g1): the numbers left of each pair of lines, each range under its own pair
    W.append(text('b_hi', 1242, 421, 100, 28, '100', 'm_gl', 'bluegrey', 'right', 1))
    W.append(text('b_mid', 1189, 501, 100, 28, '50', 'm_gl', 'bluegrey', 'right', 1))
    W.append(text('b_lo', 1142, 578, 100, 28, '0', 'm_gl', 'bluegrey', 'right', 1))
    W.append(text('b_unit', 1262, 458, 40, 29, '%', 'm_tiny', 'faint', 'center', 1))
    W.append(text('f_hi', 1403, 425, 100, 28, '1', 'm_gl', 'bluegrey', 'right', 1))
    W.append(text('f_mid', 1354, 501, 100, 28, '1/2', 'm_gl', 'bluegrey', 'right', 1))
    W.append(text('f_lo', 1311, 575, 100, 28, '0', 'm_gl', 'bluegrey', 'right', 1))
    W.append(text('ev_range', 1180, 614, 90, 34, '{{evRange}}', 'm_mid', 'fg', 'right', 1))
    W.append(text('ev_range_unit', 1276, 620, 44, 29, '{{u:distLc}}', 'm_tiny', 'dim', conn=1))
    W.append(text('range', 1348, 614, 90, 34, '{{range}}', 'm_mid', 'fg', 'right', 1))
    W.append(text('range_unit', 1444, 620, 44, 29, '{{u:distLc}}', 'm_tiny', 'dim', conn=1))
    # the oil and outside temperatures in the free space on the right, under BMW's black box (x 1406..1597, y 342..419)
    W.append(icon('oil_icon', 'oilcan', 1650, 446, 29, 34, 'dim', 1))
    W.append(text('oil', 1684, 447, 96, 34, '{{oil}}', 'm_mid', 'fg', 'right', 1))
    W.append(text('oil_unit', 1786, 453, 44, 29, '{{u:temp}}', 'm_tiny', 'dim', conn=1))
    W.append(icon('out_icon', 'therm', 1650, 506, 29, 34, 'dim', 1))
    W.append(text('outside', 1684, 507, 96, 34, '{{ambient}}', 'm_mid', 'fg', 'right', 1))
    W.append(text('outside_unit', 1786, 513, 44, 29, '{{u:temp}}', 'm_tiny', 'dim', conn=1))
    # bottom row: the clock on the left (it stops before BMW's belt light at x 587), the battery charge on the right
    W.append(text('time', 230, 672, 133, 34, '{{time}}', 'm_mid', 'fg', 'right'))
    W.append(text('ampm', 369, 678, 53, 29, '{{ampmLc}}', 'm_tiny', 'dim'))
    W.append(icon('batt_icon', 'battery', 1360, 671, 26, 34, 'dim', 1))
    W.append(text('ev_pct', 1392, 672, 76, 34, '{{hvSoc}}', 'm_mid', 'fg', 'right', 1))
    W.append(text('ev_pct_unit', 1472, 678, 30, 29, '%', 'm_tiny', 'dim', conn=1))
    W.append(text('drive_mode', 1664, 698, 216, 22, '{{modeName}}', 'mode', 'dim', 'right', 1))
    return {
        'schemaVersion': 2, 'name': 'M Blade', 'theme': 'mblade',
        '_about': "M Blade, after a photo of a BMW M cluster view (Nov 14 2026), generated by tools/gen_mblade_navi.py (edit that and regenerate): "
                  "a blue card with the M stripes and a dark plate for the gear and the speed, a red rev blade leaning right (0..7000 rpm, "
                  "the stock-style shift light and the lettering at the top), and two thin gauge pairs to its right: the hybrid battery (in "
                  "place of the photo's oil temperature) and the fuel with the range. The oil temperature, the outside temperature, the "
                  "battery and the electric range run along the bottom, clear of BMW's belt light (x 587..626, y 663..700). With 'Show Waze "
                  "map inside the theme' (or Cluster Centre / Cluster Info) the card is cut see-through at x 448..902, y 176..450 and the "
                  "gear and speed move under it. The blade and the gauges keep clear of the black box BMW draws at x 1406..1597, y 342..419. "
                  "Widget reference: shared/hud.js header.",
        'widgets': W,
    }


# ------------------------------------------------------------------------------------------------ Navi
def navi():
    W = []
    W.append({
        'id': 'backdrop', 'type': 'navi', 'class': 'content', 'z': 1, 'x': 0, 'y': 0, 'w': 1920, 'h': 720,
        'band': {'tip': [1.5, 179.7], 'slope': 0.932, 'bottom': 618, 'sep': [93.6, 0.0225], 'edge': [224.5, -0.034], 'top': 227},
        'scale': [236, 612],
        'line': [474, 618, 1404, 1453], 'line2': [577, 1500, 1620],
        'barL': [152, 679, 240], 'barR': [1270, 679, 210],
        'hole': [416, 120, 984, 488], 'holeWhen': 'mapUp', 'holeInset': 8, 'holeRadius': 34,
    })
    W.append(shiftlight(750, 34))          # where BMW's own shift light sits (x 750..1170)
    W.append(emblem(440, 22))              # the lettering, left of it (ink 132 px wide, centred in the 360 px box: x 554..686)
    # speed scale labels (SPEED_SCALE 0..250 / 0..160 mph) along the band's lower-left side
    for i in range(8):
        y = 612 - 47 * i
        xl = 1.5 + (y - 179.7) / 0.932
        W.append(text('spd%d' % i, round(xl - 24 - 70), round(y - 19), 70, 38, '{{spd:%d}}' % i, 'm_num', align='right',
                      near=['speed', i]))
    # gear and speed: big in the middle while there is no map window, small at the lower left under the band while there is
    W.append(text('gear', 810, 215, 300, 117, '{{gear}}', 'm_gear', align='center', toggle='!mapUp'))
    W.append(text('speed', 760, 340, 400, 82, '{{speed}}', 'm_speed', align='center', toggle='!mapUp'))
    W.append(text('speed_unit', 760, 424, 400, 29, '{{u:speedLc}}', 'm_tiny', 'dim', 'center', toggle='!mapUp'))
    W.append(text('mgear', 40, 436, 190, 70, '{{gear}}', 's_gear', align='left', toggle='mapUp'))
    W.append(text('mspeed', 40, 506, 200, 82, '{{speed}}', 'm_speed', align='left', toggle='mapUp'))
    W.append(text('mspeed_unit', 176, 558, 80, 29, '{{u:speedLc}}', 'm_tiny', 'dim', 'left', toggle='mapUp'))
    # the two bars along the bottom, each with its remaining range above its right end: the fuel on the left, the hybrid
    # battery on the right (its charge above its left end); the clock between them stops before BMW's belt light (x 587)
    W.append(icon('fuel_icon', 'fuel', 112, 662, 29, 34))
    W.append(text('range', 226, 630, 114, 34, '{{range}}', 'm_mid', 'fg', 'right'))
    W.append(text('range_unit', 346, 636, 48, 29, '{{u:distLc}}', 'm_tiny', 'dim'))
    W.append(text('time', 395, 664, 140, 34, '{{time}}', 'm_mid', 'fg', 'right'))
    W.append(text('ampm', 541, 670, 44, 29, '{{ampmLc}}', 'm_tiny', 'dim'))
    W.append(icon('batt_icon', 'battery', 1230, 662, 26, 34, 'dim', 1))
    W.append(text('ev_pct', 1270, 630, 64, 34, '{{hvSoc}}', 'm_mid', 'fg', 'left', 1))
    W.append(text('ev_pct_unit', 1340, 636, 30, 29, '%', 'm_tiny', 'dim', conn=1))
    W.append(text('ev_range', 1370, 630, 60, 34, '{{evRange}}', 'm_mid', 'fg', 'right', 1))
    W.append(text('ev_range_unit', 1436, 636, 44, 29, '{{u:distLc}}', 'm_tiny', 'dim', conn=1))
    # the oil and outside temperatures in the free space on the right (right of the map window, under BMW's black box)
    W.append(icon('oil_icon', 'oilcan', 1650, 446, 29, 34, 'dim', 1))
    W.append(text('oil', 1684, 447, 96, 34, '{{oil}}', 'm_mid', 'fg', 'right', 1))
    W.append(text('oil_unit', 1786, 453, 44, 29, '{{u:temp}}', 'm_tiny', 'dim', conn=1))
    W.append(icon('out_icon', 'therm', 1650, 506, 29, 34, 'dim', 1))
    W.append(text('outside', 1684, 507, 96, 34, '{{ambient}}', 'm_mid', 'fg', 'right', 1))
    W.append(text('outside_unit', 1786, 513, 44, 29, '{{u:temp}}', 'm_tiny', 'dim', conn=1))
    W.append(text('drive_mode', 1664, 698, 216, 22, '{{modeName}}', 'mode', 'dim', 'right', 1))
    return {
        'schemaVersion': 2, 'name': 'Navi', 'theme': 'navi',
        '_about': "Navi, after a photo of a BMW map view (Nov 14 2026), generated by tools/gen_mblade_navi.py (edit that and regenerate): "
                  "a wide diagonal speed band on the left (textured blue stripe, violet stripe, a white marker at the speed on the "
                  "same scale as the Sport theme), the big rounded map window (x 424..1392, y 128..600, inside the map slot and left of "
                  "BMW's black box at x 1406) with the white line under it that steps up at the right, and thin bars along the bottom: "
                  "fuel with its range on the left, the hybrid battery with its electric range on the right (in place of the photo's oil "
                  "temperature, which moves to the free column on the right). The stock-style shift light and the lettering are at the top. Without a "
                  "map window the gear and the speed are big in the middle; with one (Waze, Cluster Centre, Cluster Info) they move under "
                  "the band. Clear of BMW's belt light (x 587..626, y 663..700). Widget reference: shared/hud.js header.",
        'widgets': W,
    }


if __name__ == '__main__':
    for name, L in (('mblade', mblade()), ('navi', navi())):
        p = os.path.join(OUT, name + '.json')
        with open(p, 'w') as f:
            json.dump(L, f, indent=2)
            f.write('\n')
        print('wrote', os.path.normpath(p), len(L['widgets']), 'widgets')
