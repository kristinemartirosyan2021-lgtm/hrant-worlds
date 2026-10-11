import math, random, base64, sys
S = sys.argv[1]; W, H = 1080, 1920
def b64(f): return base64.b64encode(open(f"{S}/{f}", "rb").read()).decode()
FONTS = f"""@font-face {{ font-family: M; src: url(data:font/woff2;base64,{b64('Montserrat.woff2')}) format('woff2'); font-weight: 100 900; }}
@font-face {{ font-family: C; src: url(data:font/woff2;base64,{b64('CormorantGaramond.woff2')}) format('woff2'); font-weight: 300 700; }}
@font-face {{ font-family: A; src: url(data:font/woff2;base64,{b64('NotoSansArmenian.woff2')}) format('woff2'); font-weight: 100 900; }}"""

DEFS = """<defs>
<radialGradient id="glow" cx="50%" cy="GLOWY%" r="60%"><stop offset="0" stop-color="#3a2f12" stop-opacity=".9"/><stop offset=".45" stop-color="#1a160c" stop-opacity=".6"/><stop offset="1" stop-color="#111" stop-opacity="0"/></radialGradient>
<radialGradient id="vig" cx="50%" cy="50%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>
<linearGradient id="waveG" x1="0" x2="1"><stop offset="0" stop-color="#D4AF37" stop-opacity="0"/><stop offset=".3" stop-color="#E9D08A"/><stop offset=".55" stop-color="#FFFFFF"/><stop offset=".8" stop-color="#D4AF37"/><stop offset="1" stop-color="#D4AF37" stop-opacity="0"/></linearGradient>
<radialGradient id="gold" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#FFF8E1"/><stop offset=".12" stop-color="#F3DC98"/><stop offset=".42" stop-color="#D4AF37"/><stop offset=".75" stop-color="#6E5214"/><stop offset="1" stop-color="#1E1606"/></radialGradient>
<radialGradient id="chrome" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".25" stop-color="#D9D9D9"/><stop offset=".55" stop-color="#6D6D6D"/><stop offset=".8" stop-color="#1C1C1C"/><stop offset="1" stop-color="#9A9A9A"/></radialGradient>
<linearGradient id="glassRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".85"/><stop offset=".35" stop-color="#FFFFFF" stop-opacity=".08"/><stop offset=".6" stop-color="#D4AF37" stop-opacity=".55"/><stop offset="1" stop-color="#FFFFFF" stop-opacity=".1"/></linearGradient>
<linearGradient id="glassFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".16"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity=".02"/><stop offset="1" stop-color="#D4AF37" stop-opacity=".10"/></linearGradient>
<linearGradient id="prism" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".55"/><stop offset=".5" stop-color="#C9C9C9" stop-opacity=".08"/><stop offset="1" stop-color="#D4AF37" stop-opacity=".45"/></linearGradient>
<linearGradient id="hair" x1="0" x2="1"><stop offset="0" stop-color="#D4AF37" stop-opacity="0"/><stop offset=".5" stop-color="#D4AF37"/><stop offset="1" stop-color="#D4AF37" stop-opacity="0"/></linearGradient>
<linearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF4D6"/><stop offset=".5" stop-color="#D4AF37"/><stop offset="1" stop-color="#6E5214"/></linearGradient>
<filter id="blur6"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="blur18"><feGaussianBlur stdDeviation="18"/></filter>
<filter id="soft"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
</defs>"""

def wave(y0, rise, amp, seed=0, n=46):
    out = []
    for i in range(n):
        t = i / (n - 1); pts = []
        for k in range(61):
            u = k / 60; x = -80 + k * (W + 160) / 60
            y = y0 - rise * u + amp * math.sin(u * 2.6 * math.pi + t * 2.2 + seed) * (0.6 + 0.4 * math.sin(t * math.pi)) + (t - .5) * 120 * math.sin(u * math.pi)
            pts.append((x, y))
        d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        out.append(f'<path d="{d}" stroke="url(#waveG)" stroke-width="{0.8 + 1.2 * math.sin(t*math.pi):.2f}" fill="none" opacity="{0.10 + 0.55 * math.sin(t*math.pi)**3:.2f}"/>')
    w = "".join(out)
    return f'<g filter="url(#blur6)" opacity=".8">{w}</g><g>{w}</g>'

def particles(seed, y0=None, rise=0, n=200):
    rnd = random.Random(seed); out = []
    for _ in range(n):
        x = rnd.uniform(0, W); u = x / W
        y = (y0 - rise * u + rnd.gauss(0, 90)) if (y0 and rnd.random() < .65) else rnd.uniform(100, 1840)
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rnd.choice([.8,1,1.2,1.6,2.2,3])}" fill="{rnd.choice(["#F3E2B3","#D4AF37","#FFFFFF","#E8E8E8"])}" opacity="{rnd.uniform(.15,.9):.2f}"/>')
    for _ in range(12):
        out.append(f'<circle cx="{rnd.uniform(0,W):.0f}" cy="{rnd.uniform(200,1700):.0f}" r="{rnd.uniform(8,26):.0f}" fill="#D4AF37" opacity="{rnd.uniform(.05,.14):.2f}" filter="url(#soft)"/>')
    return "".join(out)

def ring(cx, cy, r, rot=-28, s=1):
    return f'''<g transform="translate({cx} {cy}) rotate({rot}) scale({s})">
<circle r="250" fill="none" stroke="#D4AF37" stroke-opacity=".18" stroke-width="70" filter="url(#blur18)"/>
<circle r="250" fill="none" stroke="url(#glassFill)" stroke-width="64"/>
<circle r="282" fill="none" stroke="url(#glassRing)" stroke-width="2.2"/>
<circle r="218" fill="none" stroke="url(#glassRing)" stroke-width="1.6" transform="rotate(180)"/>
<path d="M-250,-60 A257,257 0 0 1 -60,-250" stroke="#FFF" stroke-width="5" stroke-linecap="round" fill="none" opacity=".75" filter="url(#soft)"/>
<path d="M-246,-40 A250,250 0 0 1 -40,-246" stroke="#FFF" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".95"/>
<path d="M170,190 A257,257 0 0 0 250,40" stroke="#E9D08A" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/></g>'''

def gold_sphere(cx, cy, r, shadow=True):
    sh = f'<ellipse cx="{cx+5}" cy="{cy+r*1.25:.0f}" rx="{r*1.15:.0f}" ry="{r*.2:.0f}" fill="#000" opacity=".7" filter="url(#shadow)"/>' if shadow else ""
    return f'''{sh}<circle cx="{cx}" cy="{cy}" r="{r*1.03:.0f}" fill="#D4AF37" opacity=".25" filter="url(#blur18)"/><circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#gold)"/>
<ellipse cx="{cx-r*.35:.0f}" cy="{cy-r*.39:.0f}" rx="{r*.33:.0f}" ry="{r*.19:.0f}" fill="#FFF" opacity=".55" transform="rotate(-30 {cx-r*.35:.0f} {cy-r*.39:.0f})" filter="url(#soft)"/>'''

def chrome(cx, cy, r):
    return f'''<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#chrome)"/><ellipse cx="{cx-r*.32:.0f}" cy="{cy-r*.36:.0f}" rx="{r*.3:.0f}" ry="{r*.18:.0f}" fill="#FFF" opacity=".8" transform="rotate(-30 {cx-r*.32:.0f} {cy-r*.36:.0f})" filter="url(#soft)"/>
<path d="M{cx-r*.75:.0f},{cy+r*.57:.0f} A{r},{r} 0 0 0 {cx+r*.89:.0f},{cy+r*.36:.0f}" stroke="#D4AF37" stroke-width="2.5" fill="none" opacity=".7"/>'''

def prism(cx, cy, rot, s=1):
    return f'''<g transform="translate({cx} {cy}) rotate({rot}) scale({s})"><polygon points="0,-120 70,40 -55,80" fill="url(#prism)" opacity=".75"/>
<polygon points="0,-120 70,40 -55,80" fill="none" stroke="#FFF" stroke-opacity=".7" stroke-width="1.2"/><line x1="0" y1="-120" x2="8" y2="30" stroke="#FFF" stroke-opacity=".45"/>
<line x1="8" y1="30" x2="70" y2="40" stroke="#FFF" stroke-opacity=".3"/><line x1="8" y1="30" x2="-55" y2="80" stroke="#D4AF37" stroke-opacity=".5"/></g>'''

def eq(cx, cy, n=41, w=10, gap=8, hmax=150, seed=3):
    rnd = random.Random(seed); out = []; x0 = cx - (n * (w + gap) - gap) / 2
    for i in range(n):
        t = i / (n - 1); env = math.sin(t * math.pi) ** 1.4
        h = max(6, hmax * env * (0.45 + 0.55 * abs(math.sin(i * 1.7 + rnd.random()))))
        out.append(f'<rect x="{x0 + i*(w+gap):.1f}" y="{cy-h/2:.1f}" width="{w}" height="{h:.1f}" rx="{w/2}" fill="url(#bar)" opacity="{0.55+0.45*env:.2f}"/>')
    g = "".join(out)
    return f'<g filter="url(#blur6)" opacity=".7">{g}</g>{g}'

CSS = """html,body{margin:0;background:#111}.p{position:relative;width:1080px;height:1920px;overflow:hidden;background:#111}
svg.bg{position:absolute;inset:0}.t{position:absolute;left:0;right:0;text-align:center}
.gold{background:linear-gradient(180deg,#FBF0CF 0%,#E9CF85 30%,#D4AF37 52%,#8E6C1E 70%,#E7CC80 86%,#FFF4D6 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 18px rgba(212,175,55,.35))}
.silver{background:linear-gradient(90deg,#BFBFBF,#FFF 50%,#BFBFBF);-webkit-background-clip:text;background-clip:text;color:transparent}
.logo{top:120px;font-family:M;font-weight:300;font-size:34px;letter-spacing:.42em;padding-left:.42em}
.logo2{top:172px;font-family:M;font-weight:400;font-size:15px;letter-spacing:.7em;padding-left:.7em;color:#CFCFCF}
.foot{top:1770px;font-family:M;font-weight:400;font-size:20px;letter-spacing:.36em;padding-left:.36em}
.arm{font-family:A;font-weight:300}
.kicker{font-family:M;font-weight:500;font-size:22px;letter-spacing:.5em;padding-left:.5em;color:#D4AF37}
"""
HEAD = '<div class="t logo gold">AIQEZSONGS</div><div class="t logo2">AI STUDIO</div>'
FOOT = '<div class="t foot silver">AI MEMORIES THAT LAST FOREVER</div>'

def page(glowy, svg_body, html_body, foot=True):
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{FONTS}{CSS}</style></head><body><div class="p">
<svg class="bg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{DEFS.replace('GLOWY', str(glowy))}<rect width="{W}" height="{H}" fill="url(#glow)"/>{svg_body}
<rect x="470" y="1735" width="140" height="1" fill="url(#hair)"/><rect width="{W}" height="{H}" fill="url(#vig)"/></svg>
{HEAD}{html_body}{FOOT if foot else ''}</div></body></html>"""

stories = {}
# 1 — Your story. Your song.
stories["01-your-story-your-song"] = page(45,
    ring(860, 470, 0, rot=-20, s=.85) + wave(1450, 260, 70, seed=1) + particles(11, 1450, 260) + gold_sphere(860, 1500, 70) + chrome(170, 470, 34),
    '''<div class="t gold" style="top:720px;font-family:M;font-weight:200;font-size:94px;letter-spacing:.08em;padding-left:.08em;line-height:1.15">YOUR STORY.<br>YOUR SONG.</div>
<div class="t arm" style="top:1000px;font-size:38px;color:#EDEDED;letter-spacing:.06em">Քո պատմությունը՝ քո երգը</div>''')

# 2 — Made for
items = ["BIRTHDAYS", "WEDDINGS", "LOVE STORIES", "ANNIVERSARIES", "FAMILY MEMORIES"]
lst = "".join(f'<div class="t silver" style="top:{600 + i*150}px;font-family:M;font-weight:300;font-size:50px;letter-spacing:.22em;padding-left:.22em">{it}</div>' for i, it in enumerate(items))
lines = "".join(f'<rect x="390" y="{695 + i*150}" width="300" height="1" fill="url(#hair)"/>' for i in range(4))
dots = "".join(f'<circle cx="540" cy="{695 + i*150}" r="4" fill="#D4AF37"/>' for i in range(4))
stories["02-made-for"] = page(48,
    prism(905, 420, -12, 1.1) + gold_sphere(150, 1520, 85) + particles(22) + lines + dots,
    f'<div class="t kicker" style="top:440px">A SONG MADE FOR</div>{lst}')

# 3 — How it works
cards = ""; html = '<div class="t kicker" style="top:400px">HOW IT WORKS</div>'
steps = [("01", "SHARE YOUR STORY", "Names, memories, the moments that matter"), ("02", "AI COMPOSES", "Lyrics and melody, crafted just for you"), ("03", "KEEP IT FOREVER", "Your personal song, ready to gift")]
for i, (n, t, d) in enumerate(steps):
    y = 520 + i * 360
    cards += f'<rect x="110" y="{y}" width="860" height="300" rx="36" fill="url(#glassFill)" stroke="url(#glassRing)" stroke-width="1.6"/><path d="M146 {y+2} H520" stroke="#FFF" stroke-opacity=".5" stroke-width="1.5"/>'
    html += f'''<div class="t gold" style="top:{y+44}px;font-family:C;font-weight:500;font-size:84px">{n}</div>
<div class="t" style="top:{y+160}px;font-family:M;font-weight:500;font-size:34px;letter-spacing:.24em;padding-left:.24em;color:#F2F2F2">{t}</div>
<div class="t" style="top:{y+222}px;font-family:M;font-weight:300;font-size:24px;letter-spacing:.04em;color:#A9A9A9">{d}</div>'''
stories["03-how-it-works"] = page(50, particles(33, n=150) + gold_sphere(950, 470, 46, False) + chrome(120, 1540, 40) + cards, html)

# 4 — Quote with equalizer
stories["04-memories-melody"] = page(50,
    eq(540, 1180) + particles(44, 1250, 0) + ring(900, 330, 0, rot=-40, s=.6) + gold_sphere(170, 1500, 60),
    '''<div class="t" style="top:640px;font-family:C;font-weight:300;font-size:92px;line-height:1.12;color:#F5F5F5">Some memories<br>deserve <span class="gold" style="font-weight:500">a melody</span></div>
<div class="t arm" style="top:1360px;font-size:34px;color:#CFCFCF;letter-spacing:.04em">Որոշ հիշողություններ արժանի են մեղեդու</div>''')

# 5 — CTA
stories["05-order-your-song"] = page(46,
    ring(540, 900, 0, rot=-24, s=1.0) + gold_sphere(540, 900, 120, False) + particles(55, 1000, 0),
    '''<div class="t kicker" style="top:440px">THE PERFECT GIFT</div>
<div class="t gold" style="top:1270px;font-family:M;font-weight:200;font-size:74px;letter-spacing:.1em;padding-left:.1em">ORDER YOUR SONG</div>
<div class="t" style="top:1400px"><span style="display:inline-block;padding:22px 54px;border:1.5px solid #D4AF37;border-radius:60px;font-family:M;font-weight:500;font-size:28px;letter-spacing:.3em;color:#F2F2F2">DM @AIQEZSONGS</span></div>
<div class="t arm" style="top:1530px;font-size:30px;color:#BDBDBD">Գրեք մեզ՝ պատվիրելու համար</div>''')

for k, v in stories.items():
    open(f"{S}/story-{k}.html", "w").write(v)
print(" ".join(stories))
