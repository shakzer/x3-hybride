#!/usr/bin/env python3
"""Bake the "ONE OF ONE" / "1/1 EDITION" lettering into hud/emblems/oo1..oo6, ed1..ed6.json (alpha only; shared/emblems.js paints the gradient).
Run on the Mac / here: python3 tools/bake_emblems.py. Fonts are the ones in tools/fonts-src (OFL: Barlow, Michroma, Orbitron).
Our own lettering: text only, no logo of any brand."""
import base64, json, os
from PIL import Image, ImageDraw, ImageFont, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, 'fonts-src') + os.sep
OUT = os.path.join(HERE, '..', 'apps', 'cluster_themes', 'hud', 'emblems')
S = 4                      # supersampling, then LANCZOS down to the box
BOX_W, BOX_H = 360, 96     # the widget box in sport.json (the lettering is fitted into it)


def font(name, size, var=None):
    f = ImageFont.truetype(FONTS + name, int(size * S))
    if var:
        f.set_variation_by_name(var)
    return f


def run(text, f, track):
    w = sum(f.getlength(c) for c in text) + track * S * (len(text) - 1)
    asc, desc = f.getmetrics()
    im = Image.new('L', (int(w) + 20, asc + desc + 20), 0)
    d = ImageDraw.Draw(im); x = 10
    for c in text:
        d.text((x, 10), c, font=f, fill=255); x += f.getlength(c) + track * S
    return im.crop(im.getbbox())


def outline(text, f, track, t):
    w = sum(f.getlength(c) for c in text) + track * S * (len(text) - 1)
    asc, desc = f.getmetrics(); pad = 30
    a = Image.new('L', (int(w) + 2 * pad, asc + desc + 2 * pad), 0); b = a.copy()
    da, db = ImageDraw.Draw(a), ImageDraw.Draw(b); x = pad
    for c in text:
        da.text((x, pad), c, font=f, fill=255, stroke_width=t * S, stroke_fill=255)
        db.text((x, pad), c, font=f, fill=255); x += f.getlength(c) + track * S
    m = ImageChops.subtract(a, b)
    return m.crop(m.getbbox())


def bar(w, h, slant=0):
    im = Image.new('L', (int(w + slant), int(h)), 0)
    ImageDraw.Draw(im).polygon([(slant, 0), (w + slant, 0), (w, h), (0, h)], fill=255)
    return im


def stack(ms, gap):
    W = max(m.width for m in ms); H = sum(m.height for m in ms) + gap * S * (len(ms) - 1)
    im = Image.new('L', (W, H), 0); y = 0
    for m in ms:
        im.paste(m, ((W - m.width) // 2, y)); y += m.height + gap * S
    return im


def side(ms, gap):
    H = max(m.height for m in ms); W = sum(m.width for m in ms) + gap * S * (len(ms) - 1)
    im = Image.new('L', (W, H), 0); x = 0
    for m in ms:
        im.paste(m, (x, (H - m.height) // 2)); x += m.width + gap * S
    return im


def skew(m, k):
    h = m.height; ex = int(k * h) + 2
    big = Image.new('L', (m.width + ex, h), 0); big.paste(m, (0, 0))
    out = big.transform(big.size, Image.AFFINE, (1, k, -k * h, 0, 1, 0), resample=Image.BICUBIC)
    return out.crop(out.getbbox())


def variants():
    v = {}
    t = skew(run('ONE OF ONE', font('BarlowCondensed-Bold.ttf', 125), 12), 0.2)
    v['oo1'] = stack([t, bar(t.width, 12 * S, 16 * S)], 10)
    t = run('ONE OF ONE', font('Michroma-Regular.ttf', 44), 14)
    v['oo2'] = stack([bar(t.width, 5 * S), t, bar(t.width, 5 * S)], 22)
    v['oo3'] = skew(run('ONE OF ONE', font('Orbitron[wght].ttf', 70, 'Bold'), 12), 0.2)
    one = run('ONE', font('BarlowCondensed-Bold.ttf', 86), 30); of = run('OF', font('BarlowCondensed-Bold.ttf', 34), 16)
    lw = int(one.width * 0.30)
    v['oo4'] = skew(stack([one, side([bar(lw, 4 * S), of, bar(lw, 4 * S)], 18), one], 14), 0.15)
    n = run('1', font('BarlowCondensed-Bold.ttf', 190), 0); o = run('OF', font('BarlowCondensed-Bold.ttf', 64), 12)
    # 4b: the same stack, upright and lighter, as clean as the car's own screens
    SC = 'BarlowSemiCondensed-Medium.ttf'
    one = run('ONE', font(SC, 70), 36); of = run('OF', font(SC, 26), 18)
    lw = int(one.width * 0.34)
    v['oo4b'] = stack([one, side([bar(lw, 3 * S), of, bar(lw, 3 * S)], 16), one], 12)
    v['oo5'] = skew(side([n, o, n], 34), 0.2)
    v['oo6'] = skew(outline('// ONE OF ONE //', font('Orbitron[wght].ttf', 50, 'Bold'), 10, 3), 0.2)
    # "EDITION" versions
    BC, MI, OR = 'BarlowCondensed-Bold.ttf', 'Michroma-Regular.ttf', 'Orbitron[wght].ttf'
    t1 = skew(run('1/1', font(BC, 170), 8), 0.2)
    v['ed1'] = stack([t1, run('EDITION', font(MI, 24), 26)], 14)
    t1 = skew(run('ONE OF ONE', font(BC, 105), 12), 0.2)
    bw = int(t1.width * 0.28)
    v['ed2'] = stack([t1, side([bar(bw, 4 * S), run('EDITION', font(MI, 22), 30), bar(bw, 4 * S)], 18)], 12)
    v['ed3'] = side([skew(run('1/1', font(BC, 150), 6), 0.2), skew(run('EDITION', font(BC, 70), 14), 0.2)], 30)
    v['ed4'] = stack([skew(run('ONE OF ONE', font(OR, 64, 'Bold'), 12), 0.2), skew(outline('EDITION', font(OR, 36, 'Bold'), 22, 2), 0.2)], 12)
    t1 = skew(run('1/1', font(BC, 170), 10), 0.2)
    bw = int(t1.width * 0.35)
    v['ed5'] = stack([side([bar(bw, 4 * S), run('EDITION', font(MI, 22), 28), bar(bw, 4 * S)], 18), t1], 10)
    t1 = run('ONE OF ONE', font(MI, 36), 12)
    v['ed6'] = stack([t1, bar(t1.width, 4 * S), outline('EDITION', font(MI, 36), 12, 2)], 14)
    return v


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, m in sorted(variants().items()):
        k = min(BOX_W * S / m.width, BOX_H * S / m.height) / S       # fit the box, keep the shape
        w, h = max(1, round(m.width * k)), max(1, round(m.height * k))
        a = m.resize((w, h), Image.LANCZOS)
        with open(os.path.join(OUT, name + '.json'), 'w') as f:
            json.dump({'w': w, 'h': h, 'alpha': base64.b64encode(a.tobytes()).decode('ascii')}, f, separators=(',', ':'))
        print(name, w, 'x', h)


if __name__ == '__main__':
    main()
