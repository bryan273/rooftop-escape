# Injects base64-encoded CC0 voice recordings into index.html (idempotent).
import base64, io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, "index.html")
ASSETS = os.path.join(ROOT, "_assets")

NAMES = ["scream", "screech", "zroar", "snarl", "growl1", "growl2",
         "growl3", "zmouth", "eat", "zbreath", "hurt"]

MARKER = "  AUD.noise=noiseBuf;\n"
BEGIN = "  /* === real zombie voice recordings (CC0, OpenGameArt) — embedded, decoded async, replaces synth === */\n"
END = "  /* === end voice recordings === */\n"

def build_block():
    parts = [BEGIN, "  const VOX_B64={\n"]
    for n in NAMES:
        with open(os.path.join(ASSETS, n + ".mp3"), "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        parts.append('  %s:"data:audio/mpeg;base64,%s",\n' % (n, b64))
    parts.append("  };\n")
    parts.append(
        "  for(const k in VOX_B64){const bin=atob(VOX_B64[k].split(',')[1]),u=new Uint8Array(bin.length);\n"
        "    for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);\n"
        "    ctx.decodeAudioData(u.buffer).then(ab=>{AUD.B[k]=ab;}).catch(e=>console.warn('vox decode failed:',k,e));}\n"
    )
    parts.append(END)
    return "".join(parts)

with io.open(HTML, encoding="utf-8") as f:
    src = f.read()

# remove a previous injection if present
pat = re.compile(re.escape(BEGIN) + r".*?" + re.escape(END), re.S)
src, n = pat.subn("", src)
if n:
    print("removed previous injection")

if MARKER not in src:
    raise SystemExit("marker not found in index.html")
src = src.replace(MARKER, MARKER + build_block(), 1)

with io.open(HTML, "w", encoding="utf-8", newline="") as f:
    f.write(src)

print("embedded %d clips (%.1f KB base64)" % (len(NAMES), len(build_block()) / 1024))
