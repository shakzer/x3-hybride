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


def icon(id, name, x, y, w, h, color='dim', conn=0, **kw):
    d = {'id': id, 'type': 'icon', 'icon': name, 'z': 5, 'x': x, 'y': y, 'w': w, 'h': h, 'color': color}
    if conn:
        d['conn'] = conn
    d.update(kw)
    return d


def shiftlight(x, y):
    return {'id': 'shiftlight', 'type': 'shiftlight', 'z': 3, 'x': x, 'y': y, 'w': 420, 'h': 56, 'segments': 5, 'from': 3000,
            'red': 4500, 'flash': 5500, 'gap': 11, 'center': 72, 'toggle': 'stockShiftLight'}


def emblem(x, y, keep):
    # keep: it stays while the Waze map is up
    return {'id': 'emblem', 'type': 'emblem', 'setting': 'emblem', 'keepWithMap': keep, 'z': 5, 'x': x, 'y': y, 'w': 360, 'h': 96}


# ------------------------------------------------------------------------------------------------ M Blade
# Waze's map is drawn at a fixed place: the centred 1088x480 of the panel (x 416..1504, y 120..600, its middle at x 960).
# A window has to cover that middle, so with the map up (or Cluster Centre / Cluster Info) M Blade is rebuilt: a smaller
# card on the left, the window in the middle (x 600..1010, y 168..600), the blade and its gauges moved right by DX.
DX = 148


def mb_right(dx, tog, pre):
    """The blade's labels and the two gauge pairs with their numbers, shifted right by dx, shown while `tog`; the oil and
    outside temperatures (a column on the right, higher up while the blade is shifted so they clear the second gauge)."""
    W = []
    k = {'toggle': tog}
    for i in range(8):
        y = 610 - i * (610 - 135) / 7.0
        xr = 1347 - 0.643 * (y - 105)
        W.append(text(pre + 'n%d' % i, round(xr + 42 - 18) + dx, round(y - 19), 36, 38, str(i), 'm_num', align='center', conn=1, **k))
    W.append(text(pre + 'rpm_unit', 1240 + dx, 64, 170, 29, '1/min x1000', 'm_tiny', 'faint', conn=1, **k))
    # battery gauge (g0) and fuel gauge (g1): the numbers left of each pair of lines, each range under its own pair
    W.append(text(pre + 'b_hi', 1242 + dx, 426, 100, 28, '100', 'm_gl', 'bluegrey', 'right', 1, **k))
    W.append(text(pre + 'b_mid', 1189 + dx, 501, 100, 28, '50', 'm_gl', 'bluegrey', 'right', 1, **k))
    W.append(text(pre + 'b_lo', 1142 + dx, 578, 100, 28, '0', 'm_gl', 'bluegrey', 'right', 1, **k))
    W.append(text(pre + 'b_unit', 1262 + dx, 458, 40, 29, '%', 'm_tiny', 'faint', 'center', 1, **k))
    W.append(text(pre + 'f_hi', 1403 + dx, 430, 100, 28, '1', 'm_gl', 'bluegrey', 'right', 1, **k))
    W.append(text(pre + 'f_mid', 1354 + dx, 501, 100, 28, '1/2', 'm_gl', 'bluegrey', 'right', 1, **k))
    W.append(text(pre + 'f_lo', 1311 + dx, 575, 100, 28, '0', 'm_gl', 'bluegrey', 'right', 1, **k))
    W.append(text(pre + 'ev_range', 1180 + dx, 614, 90, 34, '{{evRange}}', 'm_mid', 'fg', 'right', 1, **k))
    W.append(text(pre + 'ev_range_unit', 1276 + dx, 620, 44, 29, '{{u:distLc}}', 'm_tiny', 'dim', conn=1, **k))
    W.append(text(pre + 'range', 1348 + dx, 614, 90, 34, '{{range}}', 'm_mid', 'fg', 'right', 1, **k))
    W.append(text(pre + 'range_unit', 1444 + dx, 620, 44, 29, '{{u:distLc}}', 'm_tiny', 'dim', conn=1, **k))
    # the oil and outside temperatures in the free space on the right, under BMW's black box (x 1406..1597, y 342..419)
    # while the blade is where it was; above it (hood at x 1650 is y 75, at 1830 y 140) while it is shifted
    y0 = 446 if dx == 0 else 196
    W.append(icon(pre + 'oil_icon', 'oilcan', 1650, y0, 29, 34, 'dim', 1, **k))
    W.append(text(pre + 'oil', 1684, y0 + 1, 96, 34, '{{oil}}', 'm_mid', 'fg', 'right', 1, **k))
    W.append(text(pre + 'oil_unit', 1786, y0 + 7, 44, 29, '{{u:temp}}', 'm_tiny', 'dim', conn=1, **k))
    W.append(icon(pre + 'out_icon', 'therm', 1650, y0 + 60, 29, 34, 'dim', 1, **k))
    W.append(text(pre + 'outside', 1684, y0 + 61, 96, 34, '{{ambient}}', 'm_mid', 'fg', 'right', 1, **k))
    W.append(text(pre + 'outside_unit', 1786, y0 + 67, 44, 29, '{{u:temp}}', 'm_tiny', 'dim', conn=1, **k))
    return W


def mblade():
    W = []
    base = {
        'type': 'mblade', 'class': 'content', 'z': 1, 'x': 0, 'y': 0, 'w': 1920, 'h': 720,
        'stripe1': [375, 188, 196, 456], 'stripe2': [528, 218, 372, 441], 'stripeW': [92, 54],
        'scale': [135, 610], 'rpmMax': 7000,
    }
    W.append(dict(base, id='backdrop', toggle='!mapUp', card=[116, 149, 592, 34], cardB=[909, 1002, 322, 863],
                  plate=[301, 386, 661, 606], plateRight=919, bl=[105, 609, 1178, -0.6], br=[1347, -0.643, 1037, 707],
                  g0=[1371, 427, 1260, 601], g1=[1532, 427, 1428, 601]))
    # with the map up: the window in the middle, a small card on the left, the blade and its gauges DX to the right
    W.append(dict(base, id='backdrop_open', toggle='mapUp', card=[116, 149, 592, 34], cardB=[500, 556, 322, 460],
                  bl=[105, 609, 1178 + DX, -0.6], br=[1347 + DX, -0.643, 1037 + DX, 640],
                  g0=[1371 + DX, 427, 1260 + DX, 601], g1=[1532 + DX, 427, 1428 + DX, 601],
                  hole=[592, 160, 426, 448], holeWhen='mapUp', holeInset=8, holeRadius=22))
    W.append(shiftlight(750, 32))          # where BMW's own shift light sits (x 750..1170), as on the M and Sport themes
    # (no ONE OF ONE lettering here: centred under the shift light it runs into the card's corner and the blade's first line)
    # gear and speed on the plate; on the small card while the window is open
    W.append(text('gear', 700, 285, 240, 117, '{{gear}}', 'm_gear', align='center', toggle='!mapUp'))
    W.append(text('speed', 700, 400, 240, 82, '{{speed}}', 'm_speed', align='center', toggle='!mapUp'))
    W.append(text('speed_unit', 700, 480, 240, 29, '{{u:speedLc}}', 'm_tiny', 'dim', 'center', toggle='!mapUp'))
    W.append(text('mgear', 216, 262, 240, 117, '{{gear}}', 'm_gear', align='center', toggle='mapUp'))
    W.append(text('mspeed', 216, 386, 240, 82, '{{speed}}', 'm_speed', align='center', toggle='mapUp'))
    W.append(text('mspeed_unit', 216, 466, 240, 29, '{{u:speedLc}}', 'm_tiny', 'dim', 'center', toggle='mapUp'))
    W.extend(mb_right(0, '!mapUp', ''))
    W.extend(mb_right(DX, 'mapUp', 'o_'))
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
                  "the stock-style shift light at the top), and two thin gauge pairs to its right: the hybrid battery (in place of the "
                  "photo's oil temperature) and the fuel with the range. The battery charge runs along the bottom, clear of BMW's belt "
                  "light (x 587..626, y 663..700); the oil and outside temperatures are on the right. Waze's map is drawn at the centred "
                  "1088x480 of the panel, so with 'Show Waze map inside the theme' (or Cluster Centre / Cluster Info) the theme is rebuilt "
                  "(backdrop_open and the o_ readouts): a small card on the left with the gear and speed, the see-through window at "
                  "x 600..1010, y 168..600 over the map's middle, and the blade and gauges moved 148 px right. The blade and the gauges "
                  "keep clear of the black box BMW draws at x 1406..1597, y 342..419. Widget reference: shared/hud.js header.",
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
    W.append(emblem(780, 100, False))      # the lettering, centred right under the shift light, over the gear; hidden while the map window is open
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
