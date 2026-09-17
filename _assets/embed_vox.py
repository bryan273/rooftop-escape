# Regenerates js/vox.js: the CC0 voice recordings in _assets/*.mp3 as base64 data URIs.
# js/game.js reads them from window.VOX_B64 and decodes them at runtime.
import base64, io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "js", "vox.js")
ASSETS = os.path.join(ROOT, "_assets")

NAMES = ["scream", "screech", "zroar", "snarl", "growl1", "growl2",
         "growl3", "zmouth", "eat", "zbreath", "hurt"]

parts = [
    "/* Real zombie voice recordings (CC0, OpenGameArt) as base64 data URIs.\n"
    "   Generated from _assets/*.mp3 by _assets/embed_vox.py — decoded at runtime by js/game.js. */\n",
    "window.VOX_B64={\n",
]
for n in NAMES:
    with open(os.path.join(ASSETS, n + ".mp3"), "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    parts.append('  %s:"data:audio/mpeg;base64,%s",\n' % (n, b64))
parts.append("};\n")

with io.open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write("".join(parts))

print("wrote %s (%d clips, %.1f KB)" % (OUT, len(NAMES), sum(len(p) for p in parts) / 1024))
