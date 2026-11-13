#!/usr/bin/env python3
"""Add characters to an already baked font atlas without touching the glyphs it has.

    python3 tools/add_glyphs.py <app_id> <font name> <chars>      e.g. cluster_themes m_tiny %

Re-baking a whole font (tools/bake_fonts.py) can move a glyph by a pixel when Pillow / FreeType differ from the
Mac the shipped atlases came from. This bakes the font with the extra characters appended to the charset in
bake_fonts.py, then keeps the shipped metrics and pixels of every glyph already in the font (they must match the
new atlas pixel for pixel, else it stops) and takes only the new glyphs from the new bake. Put the same
characters at the END of the font's charset in bake_fonts.py so a full re-bake gives the same font.
"""
import base64, importlib.util, json, os, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('bake_fonts', os.path.join(HERE, 'bake_fonts.py'))
bf = importlib.util.module_from_spec(spec); spec.loader.exec_module(bf)

app, name, chars = sys.argv[1], sys.argv[2], sys.argv[3]
path = os.path.join(bf.APPS, app, 'hud', 'fonts', name + '.json')
old = json.load(open(path))
todo = [c for c in chars if c not in old['glyphs']]
if not todo:
    print(name, 'already has', chars); sys.exit(0)
fspec = [s for s in bf.FONTS[app] if s[0] == name][0]
assert all(c in fspec[3] for c in todo), 'add %r to the end of the %s charset in bake_fonts.py first' % (''.join(todo), name)
# the charset as shipped (without the new chars), so the new bake lays the old glyphs out the same way
shipped = ''.join(c for c in fspec[3] if c not in todo) + ''.join(todo)
with tempfile.TemporaryDirectory() as tmp:
    bf.bake(tmp, name, fspec[1], fspec[2], shipped, *fspec[4:])
    new = json.load(open(os.path.join(tmp, name + '.json')))
assert new['cellHeight'] == old['cellHeight'] and new['baseline'] == old['baseline'], 'the new glyphs change the cell height'
ow, oh = old['width'], old['height']
ob = base64.b64decode(old['alpha']); nb = base64.b64decode(new['alpha'])
assert new['width'] == ow and new['height'] >= oh
for c, g in old['glyphs'].items():       # the pixels of every old glyph are the same in the new atlas
    if not g['w']: continue
    ng = new['glyphs'][c]
    assert (ng['x'], ng['y'], ng['w'], ng['h']) == (g['x'], g['y'], g['w'], g['h']), 'glyph %r moved' % c
    for row in range(g['h']):
        a = (g['y'] + row) * ow + g['x']
        assert ob[a:a + g['w']] == nb[a:a + g['w']], 'glyph %r pixels differ' % c
old['glyphs'].update({c: new['glyphs'][c] for c in todo})
old['height'] = new['height']; old['alpha'] = new['alpha']
json.dump(old, open(path, 'w'), separators=(',', ':'), ensure_ascii=False)
print(name, 'added', ''.join(todo), '| atlas', ow, 'x', old['height'])
