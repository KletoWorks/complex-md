#!/usr/bin/env python3
"""Write scripts/og-glyphs.json, the glyph outlines og-image.mjs draws text with.

    python3 scripts/og-font.py

A maintainer tool, not a build step: the build reads the committed JSON and
needs no Python. Run it again only to change the weights or the character
set. It reads site/fonts/inter-latin-var.woff2 (Inter, SIL Open Font
License 1.1), fixes the variable font at each weight, and keeps printable
ASCII plus a few marks. Each glyph is its advance width and its outline as
SVG path data in font units, y up. Needs fontTools and brotli
(pip install fonttools brotli).
"""
import json
import os

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, 'site', 'fonts', 'inter-latin-var.woff2')
OUT = os.path.join(ROOT, 'scripts', 'og-glyphs.json')
WEIGHTS = {'regular': 450, 'bold': 700}
CHARS = [chr(c) for c in range(0x20, 0x7F)] + ['·', '…']


def num(v):
    r = round(v)
    return str(int(r))


def glyphs(weight):
    font = TTFont(FONT)
    font = instantiateVariableFont(font, {'wght': weight})
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    hmtx = font['hmtx']
    out = {}
    for ch in CHARS:
        name = cmap.get(ord(ch))
        if name is None:
            continue
        pen = SVGPathPen(gs, ntos=num)
        gs[name].draw(pen)
        out[ch] = {'a': hmtx[name][0], 'd': pen.getCommands()}
    return out, font


def main():
    data = {'font': 'Inter (SIL Open Font License 1.1)', 'chars': ''.join(CHARS)}
    for label, weight in WEIGHTS.items():
        g, font = glyphs(weight)
        data[label] = g
    data['unitsPerEm'] = font['head'].unitsPerEm
    data['capHeight'] = getattr(font['OS/2'], 'sCapHeight', 0)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, ensure_ascii=True, separators=(',', ':'), sort_keys=True)
        f.write('\n')
    print('wrote', OUT, os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main()
