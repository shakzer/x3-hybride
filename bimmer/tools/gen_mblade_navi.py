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


RED = [255, 64, 56, 255]


def danger_alert(x, y, h):
    """The danger zone alert (shared/danger.js), in Waze's style: a dark rounded card with a red outline, a camera, DANGER,
    the distance and, when the source gives it, the speed limit in a red ring. Shown only while a zone is ahead (toggle
    "danger"; "dangerLimit" / "dangerNoLimit" pick the card with or without the limit sign). Drawn clear of the map window and
    of BMW's zones, where the theme has room: the caller picks x, y and the height (the card is 272 wide, 210 without the limit)."""
    top = round((h - 54) / 2.0)
    W = []
    for id, w, tog in (('al_card', 272, 'dangerLimit'), ('al_card2', 210, 'dangerNoLimit')):
        W.append({'id': id, 'type': 'box', 'z': 4, 'x': x, 'y': y, 'w': w, 'h': h, 'fill': [10, 10, 14, 255], 'line': RED,
                  'border': 3, 'radius': 20, 'toggle': tog, 'conn': 1})
    k = {'toggle': 'danger'}
    W.append(icon('al_cam', 'cam', x + 14, y + round((h - 48) / 2.0), 48, 48, RED, 1, **k))
    W.append(text('al_title', x + 72, y + top, 130, 19, 'DANGER', 'm_label', RED, 'left', 1, **k))
    W.append(text('al_dist', x + 72, y + top + 25, 78, 29, '{{dangerDist}}', 'm_mid', 'fg', 'right', 1, **k))
    W.append(text('al_unit', x + 154, y + top + 24, 42, 36, '{{dangerUnit}}', 'm_unit', 'dim', 'left', 1, **k))
    W.append(icon('al_ring', 'ring', x + 196, y + round((h - 64) / 2.0), 64, 64, RED, 1, toggle='dangerLimit'))
    W.append(text('al_limit', x + 196, y + round((h - 29) / 2.0), 64, 29, '{{dangerLimit}}', 'm_tiny', 'fg', 'center', 1, toggle='dangerLimit'))
    return W


# ------------------------------------------------------------------------------------------------ M Blade
# Waze's map is drawn at a fixed place: the centred 1088x480 of the panel (x 416..1504, y 120..600, its middle at x 960).
# BMW draws a black box over x 1406..1597, y 342..419, so a window can show the map up to about x 1396. With the map up
# (or Cluster Centre / Cluster Info) the theme is rebuilt as in the Sport theme: the window in the middle (x 534..1386,
# y 120..600, the same as Sport's), the rev blade leaning on the left, the card with the speed on the right, the
# gauges below it, nothing under the map.
G_DX = 190          # how far the gauge pairs move right while the map is up


def mb_blade_labels(tog, pre, xr0, slope, ytop, mark7):
    """The 0..7 marks along the blade's right edge (x of the edge at ytop, its slope), 0 at y 610, 7 at y mark7."""
    W = []
    for i in range(8):
        y = 610 - i * (610 - mark7) / 7.0
        xr = xr0 + slope * (y - ytop)
        W.append(text(pre + 'n%d' % i, round(xr + 42 - 18), round(y - 19), 36, 38, str(i), 'm_num', align='center', conn=1, toggle=tog))
    return W


def mb_gauges(dx, tog, pre, oil_x):
    """The numbers of the two gauge pairs and their ranges (shifted right by dx), and the oil / outside temperatures."""
    W = []
    k = {'toggle': tog}
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
    W.append(icon(pre + 'oil_icon', 'oilcan', oil_x, 446, 29, 34, 'dim', 1, **k))
    W.append(text(pre + 'oil', oil_x + 34, 447, 84, 34, '{{oil}}', 'm_mid', 'fg', 'right', 1, **k))
    W.append(text(pre + 'oil_unit', oil_x + 122, 453, 44, 29, '{{u:temp}}', 'm_tiny', 'dim', conn=1, **k))
    W.append(icon(pre + 'out_icon', 'therm', oil_x, 506, 29, 34, 'dim', 1, **k))
    W.append(text(pre + 'outside', oil_x + 34, 507, 84, 34, '{{ambient}}', 'm_mid', 'fg', 'right', 1, **k))
    W.append(text(pre + 'outside_unit', oil_x + 122, 513, 44, 29, '{{u:temp}}', 'm_tiny', 'dim', conn=1, **k))
    return W


def mblade():
    W = []
    base = {'type': 'mblade', 'class': 'content', 'z': 1, 'x': 0, 'y': 0, 'w': 1920, 'h': 720, 'rpmMax': 7000}
    W.append(dict(base, id='backdrop', toggle='!mapUp', card=[116, 149, 592, 34], cardB=[909, 1002, 322, 863],
                  plate=[301, 386, 661, 606], plateRight=919,
                  stripe1=[375, 188, 196, 456], stripe2=[528, 218, 372, 441], stripeW=[92, 54],
                  bl=[105, 609, 1178, -0.6], br=[1347, -0.643, 1037, 707], scale=[135, 610],
                  g0=[1371, 427, 1260, 601], g1=[1532, 427, 1428, 601]))
    # with the map up, as in Sport: the blade on the left (leaning right, 0 at the bottom, 7 at y 190), the card with the
    # speed on the right under the hood and over BMW's black box, the gauge pairs below it
    W.append(dict(base, id='backdrop_open', toggle='mapUp', card=[1430, 150, 330, 26], cardB=[1735, 1790, 240, 1700],
                  stripe1=[1600, 152, 1500, 330], stripe2=[1700, 160, 1635, 328], stripeW=[54, 30],
                  bl=[165, 610, 305, -0.55], br=[445, -0.58, 195, 20], scale=[190, 610],
                  g0=[1371 + G_DX, 427, 1260 + G_DX, 601], g1=[1532 + G_DX, 427, 1428 + G_DX, 601],
                  hole=[524, 110, 872, 500], holeWhen='mapUp', holeInset=10, holeRadius=28))
    W.append(shiftlight(750, 32))          # where BMW's own shift light sits (x 750..1170), as on the M and Sport themes
    # (no ONE OF ONE lettering here: centred under the shift light it runs into the card's corner and the blade's first line)
    # the speed, big, on the plate; on the card at the right while the window is open. No gear: BMW's own black box (its gear
    # slot, x 1406..1597, y 342..419) already shows it
    W.append(text('speed', 700, 285, 240, 117, '{{speed}}', 'm_gear', align='center', toggle='!mapUp'))
    W.append(text('speed_unit', 700, 400, 240, 29, '{{u:speedLc}}', 'm_tiny', 'dim', 'center', toggle='!mapUp'))
    W.append(text('mspeed', 1458, 190, 230, 117, '{{speed}}', 'm_gear', align='left', toggle='mapUp'))
    W.append(text('mspeed_unit', 1696, 262, 80, 29, '{{u:speedLc}}', 'm_tiny', 'dim', 'left', toggle='mapUp'))
    W.extend(mb_blade_labels('!mapUp', '', 1347, -0.643, 105, 135))
    W.append(text('rpm_unit', 1240, 64, 170, 29, '1/min x1000', 'm_tiny', 'faint', conn=1, toggle='!mapUp'))
    W.extend(mb_blade_labels('mapUp', 'o_', 445, -0.58, 165, 190))
    W.append(text('o_rpm_unit', 300, 108, 170, 29, '1/min x1000', 'm_tiny', 'faint', conn=1, toggle='mapUp'))
    W.extend(mb_gauges(0, '!mapUp', '', 1650))
    W.extend(mb_gauges(G_DX, 'mapUp', 'o_', 1742))
    # bottom row: the clock on the left (it stops before BMW's belt light at x 587), the battery charge on the right
    W.append(text('time', 230, 672, 133, 34, '{{time}}', 'm_mid', 'fg', 'right'))
    W.append(text('ampm', 369, 678, 53, 29, '{{ampmLc}}', 'm_tiny', 'dim'))
    W.append(icon('batt_icon', 'battery', 1360, 671, 26, 34, 'dim', 1))
    W.append(text('ev_pct', 1392, 672, 76, 34, '{{hvSoc}}', 'm_mid', 'fg', 'right', 1))
    W.append(text('ev_pct_unit', 1472, 678, 30, 29, '%', 'm_tiny', 'dim', conn=1))
    W += danger_alert(1612, 338, 80)       # under the card on the right (clear of BMW's black box, x < 1597), above the gauge tips (y 427)
    W.append(text('drive_mode', 1664, 698, 216, 22, '{{modeName}}', 'mode', 'dim', 'right', 1))
    return {
        'schemaVersion': 2, 'name': 'M Blade', 'theme': 'mblade',
        '_about': "M Blade, after a photo of a BMW M cluster view (Nov 14 2026), generated by tools/gen_mblade_navi.py (edit that and regenerate): "
                  "a blue card with the M stripes and a dark plate for the speed, a red rev blade leaning right (0..7000 rpm, "
                  "the stock-style shift light at the top), and two thin gauge pairs to its right: the hybrid battery (in place of the "
                  "photo's oil temperature) and the fuel with the range. The battery charge runs along the bottom, clear of BMW's belt "
                  "light (x 587..626, y 663..700); the oil and outside temperatures are on the right. Waze's map is drawn at the centred "
                  "1088x480 of the panel and cannot be moved, so with 'Show Waze map inside the theme' (or Cluster Centre / Cluster Info) "
                  "the theme is rebuilt as the Sport theme is (backdrop_open and the o_ readouts): the see-through window in the middle "
                  "(x 534..1386, y 120..600), the blade on the left, a small card with the speed and the gauges on the right, "
                  "nothing under the map. Clear of the black box BMW draws at x 1406..1597, y 342..419. Widget reference: shared/hud.js header.",
        'widgets': W,
    }


# ------------------------------------------------------------------------------------------------ Navi
def navi():
    W = []
    base = {'type': 'navi', 'class': 'content', 'z': 1, 'x': 0, 'y': 0, 'w': 1920, 'h': 720,
            'scale': [236, 612], 'line2': [577, 1500, 1620], 'barL': [152, 679, 240], 'barR': [1270, 679, 210]}
    W.append(dict(base, id='backdrop', toggle='!mapUp',
                  band={'tip': [1.5, 179.7], 'slope': 0.932, 'bottom': 618, 'sep': [93.6, 0.0225], 'edge': [224.5, -0.034], 'top': 227},
                  line=[474, 618, 1404, 1453]))
    # with the map up, as in Sport: the window in the middle (x 534..1386, y 120..600), the band steeper and narrower so it
    # stays left of it, nothing under the map; the speed goes to the right
    W.append(dict(base, id='backdrop_open', toggle='mapUp',
                  band={'tip': [40, 179.7], 'slope': 1.6, 'bottom': 618, 'sep': [80, 0.0225], 'edge': [190, -0.034], 'top': 227},
                  line=[500, 618, 1404, 1453],
                  hole=[524, 110, 872, 500], holeWhen='mapUp', holeInset=10, holeRadius=28))
    W.append(shiftlight(750, 34))          # where BMW's own shift light sits (x 750..1170)
    W.append(emblem(780, 100, False))      # the lettering, centred right under the shift light, over the gear; hidden while the map window is open
    # speed scale labels (SPEED_SCALE 0..250 / 0..160 mph) along the band's lower-left side; 88 wide: the top "250" is three wide
    # digits and was cut at its left edge in a 70 wide box (QA, Nov 14 2026); x stays right of the hood at the far left
    for i in range(8):
        y = 612 - 47 * i
        mg = 24 if i < 7 else 14          # the top one (250) is the widest and sits at the far left, so it moves 10 px nearer the band
        xl = 1.5 + (y - 179.7) / 0.932
        W.append(text('spd%d' % i, max(10, round(xl - mg - 88)), round(y - 19), 88, 38, '{{spd:%d}}' % i, 'm_num', align='right',
                      near=['speed', i], toggle='!mapUp'))
        xo = 40 + (y - 179.7) / 1.6
        W.append(text('o_spd%d' % i, max(10, round(xo - mg - 88)), round(y - 19), 88, 38, '{{spd:%d}}' % i, 'm_num', align='right',
                      near=['speed', i], toggle='mapUp'))
    # speed: big in the middle while there is no map window, big on the right (above BMW's black box) while there is
    # (no gear: BMW's own black box, its gear slot, already shows it; the speed takes the gear's place, in the big font)
    W.append(text('speed', 760, 222, 400, 117, '{{speed}}', 'm_gear', align='center', toggle='!mapUp'))
    W.append(text('speed_unit', 760, 346, 400, 29, '{{u:speedLc}}', 'm_tiny', 'dim', 'center', toggle='!mapUp'))
    W.append(text('mspeed', 1590, 190, 240, 117, '{{speed}}', 'm_gear', align='center', toggle='mapUp'))
    W.append(text('mspeed_unit', 1670, 314, 80, 29, '{{u:speedLc}}', 'm_tiny', 'dim', 'center', toggle='mapUp'))
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
    W += danger_alert(1196, 38, 76)         # in the top strip right of the shift light: clear of the map window (y 120) and of the hood
    W.append(text('drive_mode', 1664, 698, 216, 22, '{{modeName}}', 'mode', 'dim', 'right', 1))
    return {
        'schemaVersion': 2, 'name': 'Navi', 'theme': 'navi',
        '_about': "Navi, after a photo of a BMW map view (Nov 14 2026), generated by tools/gen_mblade_navi.py (edit that and regenerate): "
                  "a wide diagonal speed band on the left (textured blue stripe, violet stripe, a white marker at the speed on the "
                  "same scale as the Sport theme), the big rounded map window with the white line under it that steps up at the right, and thin bars along the bottom: "
                  "fuel with its range on the left, the hybrid battery with its electric range on the right (in place of the photo's oil "
                  "temperature, which moves to the free column on the right). The stock-style shift light and the lettering are at the top. Without a "
                  "map window the speed is big in the middle; with one (Waze, Cluster Centre, Cluster Info) the theme is rebuilt "
                  "as the Sport theme is (backdrop_open and the o_ readouts): the window at x 534..1386, y 120..600, the band steeper "
                  "and narrower on the left, the speed big on the right above BMW's black box, nothing under the map. Clear of BMW's belt light (x 587..626, y 663..700). Widget reference: shared/hud.js header.",
        'widgets': W,
    }


if __name__ == '__main__':
    for name, L in (('mblade', mblade()), ('navi', navi())):
        p = os.path.join(OUT, name + '.json')
        with open(p, 'w') as f:
            json.dump(L, f, indent=2)
            f.write('\n')
        print('wrote', os.path.normpath(p), len(L['widgets']), 'widgets')
