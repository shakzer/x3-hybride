#!/usr/bin/env python3
"""Turns the Ministry of the Interior's list of fixed speed cameras into the "danger zone" list the app can use.

Source: Ministère de l'Intérieur, "Liste des radars fixes en France", data.gouv.fr, Licence Ouverte / Open Licence 2.0
(https://www.data.gouv.fr/datasets/liste-des-radars-fixes-en-france/). The CSV is ISO-8859-1, ';' separated, with the columns
"Numéro de radar;Type de radar;Date de mise en service;VMA ;Latitude; Longitude".

What is kept is a zone, not a camera: French law lets a driver aid announce a danger zone, not the exact place or the kind of
a speed camera (décret n° 2012-3, article R413-15; not legal advice). So:
  - the position is rounded to 0.01 degree (about 1 km), cameras that fall in the same cell become one zone;
  - the type, the number and the date are dropped;
  - each zone keeps the speed limit (the highest of its cameras, 0 when the file says "NA") and whether it is a wide zone
    (a limit of 110 or more, a motorway: 4 km around, else 2 km). Both radii are much larger than the rounding error
    (at most about 0.7 km), so the camera is always inside its zone.
The exact positions are not written anywhere in this repository: only this script and the rounded list are.

Usage: python3 tools/make_radar_zones.py <radars.csv> [out.json]   (default out: data/radars_fr_zones.json)
"""
import csv
import io
import json
import os
import sys

CELL = 0.01             # degrees: the rounding of a zone's centre
RADIUS = 2000           # metres around a zone's centre
RADIUS_WIDE = 4000      # for a zone with a limit of 110 or more (a motorway)
WIDE_FROM = 110


def main(src, out):
    raw = open(src, 'rb').read().decode('latin-1')
    rows = list(csv.reader(io.StringIO(raw), delimiter=';'))
    head = [h.strip().lower() for h in rows[0]]
    col = {k: next(i for i, h in enumerate(head) if h.startswith(k)) for k in ('vma', 'latitude', 'longitude')}
    cells = {}
    n = 0
    for r in rows[1:]:
        if len(r) < 6:
            continue
        try:
            lat = float(r[col['latitude']].replace('+', '').strip())
            lon = float(r[col['longitude']].replace('+', '').strip())
        except ValueError:
            continue
        vma = r[col['vma']].strip()
        limit = int(vma) if vma.isdigit() else 0
        n += 1
        key = (int(round(lat / CELL)), int(round(lon / CELL)))
        c = cells.setdefault(key, [0, 0])
        c[0] = max(c[0], limit)
        c[1] = 1 if c[0] >= WIDE_FROM else 0
    zones = sorted([k[0], k[1], v[0], v[1]] for k, v in cells.items())
    doc = {
        'source': "Ministère de l'Intérieur, Liste des radars fixes en France, data.gouv.fr",
        'licence': 'Licence Ouverte / Open Licence 2.0',
        'version': '2025-12-30',
        'about': "Danger zones, not cameras: centres rounded to 0.01 degree, several cameras in one cell are one zone, no type. "
                 "zones: [lat x100, lon x100, speed limit km/h (0: unknown), 1 for a wide zone].",
        'cell': CELL, 'radius': RADIUS, 'radiusWide': RADIUS_WIDE,
        'zones': zones,
    }
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, 'w') as f:
        f.write(json.dumps(doc, separators=(',', ':'), ensure_ascii=False) + '\n')
    print('%d cameras -> %d zones (%d wide), %d bytes: %s' % (n, len(zones), sum(z[3] for z in zones), os.path.getsize(out), out))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    default = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'radars_fr_zones.json')
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else default)
