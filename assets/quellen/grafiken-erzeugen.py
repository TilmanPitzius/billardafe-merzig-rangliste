import math, os
OUT='/home/claude/work/assets-src/svg'; os.makedirs(OUT, exist_ok=True)

METALS = {
 'gold':   ['#fff6d2','#f6d27a','#c9902f','#ffe9a6','#8c5a17','#5a3608'],
 'silver': ['#ffffff','#e3e8ee','#9aa5b1','#f4f7fa','#66707c','#3a4048'],
 'bronze': ['#ffe6cc','#e5a26c','#a85f2c','#f6c79c','#7a3f18','#4a230b'],
}
def metal_defs(name, m):
    c=METALS[m]
    return f'''<linearGradient id="{name}" x1="0" y1="0" x2="0.35" y2="1">
 <stop offset="0" stop-color="{c[0]}"/><stop offset=".22" stop-color="{c[1]}"/><stop offset=".48" stop-color="{c[2]}"/>
 <stop offset=".62" stop-color="{c[3]}"/><stop offset=".85" stop-color="{c[4]}"/><stop offset="1" stop-color="{c[5]}"/></linearGradient>
<linearGradient id="{name}-edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{c[5]}"/><stop offset="1" stop-color="{c[4]}"/></linearGradient>'''

GLOW='''<filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".55"/></filter>
<radialGradient id="gem" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e9fffb"/><stop offset=".35" stop-color="#5fe3d3"/><stop offset="1" stop-color="#0d6b63"/></radialGradient>
<radialGradient id="gemw" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#d9e2ea"/><stop offset="1" stop-color="#7d8a97"/></radialGradient>
<radialGradient id="gemr" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffe0d0"/><stop offset=".4" stop-color="#e2733c"/><stop offset="1" stop-color="#6a2a0c"/></radialGradient>'''

def leaf(x,y,rot,rx=5,ry=12,fill='url(#M)'):
    return f'<path d="M {x} {y-ry} C {x+rx*1.6} {y-ry*.35}, {x+rx*1.6} {y+ry*.35}, {x} {y+ry} C {x-rx*1.6} {y+ry*.35}, {x-rx*1.6} {y-ry*.35}, {x} {y-ry} Z" transform="rotate({rot:.1f} {x:.1f} {y:.1f})" fill="{fill}" stroke="url(#M-edge)" stroke-width=".8"/>' + \
           f'<path d="M {x} {y-ry*.8} L {x} {y+ry*.8}" transform="rotate({rot:.1f} {x:.1f} {y:.1f})" stroke="rgba(90,54,8,.45)" stroke-width=".8"/>'

def laurel(cx,cy,r,start,end,n,size=1.0):
    out=[]
    for side in (1,-1):
        for i in range(n):
            t=start+(end-start)*i/(n-1); a=math.radians(t)
            x=cx+side*math.cos(a)*r; y=cy-math.sin(a)*r
            rot=side*(-t+30)
            out.append(leaf(x,y,rot,4.5*size,11*size))
            # inner small leaf
            a2=math.radians(t+6); x2=cx+side*math.cos(a2)*(r-9*size); y2=cy-math.sin(a2)*(r-9*size)
            out.append(leaf(x2,y2,side*(-t-20),3.4*size,8*size))
        # stem
    return ''.join(out)

def wing(cx,cy,side,scale=1.0,metal='url(#M)'):
    # feathered wing from (cx,cy) outward
    feathers=[]
    for i in range(6):
        L=(58-i*6)*scale; ang=math.radians(-12 - i*15)
        x2=cx+side*math.cos(ang)*L; y2=cy+math.sin(ang)*L*-1
        w=9*scale
        feathers.append(f'<path d="M {cx} {cy} Q {cx+side*L*.45} {cy-w*1.6+i*1.5} {x2:.1f} {y2:.1f} Q {cx+side*L*.55} {cy+w*.4} {cx} {cy+3} Z" fill="{metal}" stroke="url(#M-edge)" stroke-width="1"/>')
    return ''.join(reversed(feathers))

def crown(cx,cy,w=70,gem='url(#gem)'):
    h=w*.55; x0=cx-w/2
    pts=[(x0,cy),(x0-w*.04,cy-h*.75),(x0+w*.22,cy-h*.38),(cx,cy-h),(x0+w*.78,cy-h*.38),(x0+w*1.04,cy-h*.75),(x0+w,cy)]
    d='M '+' L '.join(f'{x:.1f} {y:.1f}' for x,y in pts)+' Z'
    balls=''.join(f'<circle cx="{x:.1f}" cy="{y-3:.1f}" r="{w*.055:.1f}" fill="url(#M)" stroke="url(#M-edge)" stroke-width=".8"/>' for x,y in [pts[1],pts[3],pts[5]])
    band=f'<rect x="{x0:.1f}" y="{cy-h*.16:.1f}" width="{w:.1f}" height="{h*.24:.1f}" rx="2" fill="url(#M)" stroke="url(#M-edge)" stroke-width="1"/>'
    gems=''.join(f'<circle cx="{cx+dx*w:.1f}" cy="{cy-h*.04:.1f}" r="{w*.05:.1f}" fill="{gem}"/>' for dx in (-.3,0,.3))
    return f'<g filter="url(#shadow)"><path d="{d}" fill="url(#M)" stroke="url(#M-edge)" stroke-width="1.2"/>{band}{balls}{gems}<circle cx="{cx}" cy="{cy-h*.5:.1f}" r="{w*.075:.1f}" fill="{gem}" stroke="url(#M-edge)" stroke-width="1"/></g>'

def svg(w,h,body,metal='gold'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><defs>{metal_defs("M",metal)}{GLOW}</defs>{body}</svg>'

# ---------- Avatar-Rahmen ----------
def frame(metal, top):
    W,H=260,280; cx,cy,R=130,138,82
    gem={'gold':'url(#gem)','silver':'url(#gemw)','bronze':'url(#gemr)'}[metal]
    b=[]
    b.append(laurel(cx,cy+6,R+20,-62,58,7,1.1))
    pass
    # ring with beads
    b.append(f'<circle cx="{cx}" cy="{cy}" r="{R+9}" fill="none" stroke="url(#M-edge)" stroke-width="3"/>')
    b.append(f'<circle cx="{cx}" cy="{cy}" r="{R+4}" fill="none" stroke="url(#M)" stroke-width="10" filter="url(#shadow)"/>')
    b.append(f'<circle cx="{cx}" cy="{cy}" r="{R-1.5}" fill="none" stroke="url(#M-edge)" stroke-width="2"/>')
    for i in range(36):
        a=math.radians(i*10); b.append(f'<circle cx="{cx+math.cos(a)*(R+4):.1f}" cy="{cy+math.sin(a)*(R+4):.1f}" r="1.3" fill="rgba(255,255,255,.55)"/>')
    # top ornament
    if top: b.append(crown(cx,cy-R-4,74,gem))
    else:
        b.append(f'<path d="M {cx} {cy-R-26} L {cx+12} {cy-R-6} L {cx} {cy-R+2} L {cx-12} {cy-R-6} Z" fill="url(#M)" stroke="url(#M-edge)" stroke-width="1.2" filter="url(#shadow)"/><circle cx="{cx}" cy="{cy-R-11}" r="5" fill="{gem}"/>')
    # bottom plaque
    b.append(f'<path d="M {cx-30} {cy+R+4} L {cx+30} {cy+R+4} L {cx+24} {cy+R+26} L {cx-24} {cy+R+26} Z" fill="url(#M)" stroke="url(#M-edge)" stroke-width="1.2" filter="url(#shadow)"/>')
    b.append(f'<path d="M {cx} {cy+R} l 9 9 l -9 9 l -9 -9 Z" fill="{gem}" stroke="url(#M-edge)" stroke-width="1"/>')
    return svg(W,H,''.join(b),metal)

for m,top in [('gold',True),('silver',False),('bronze',False)]:
    open(f'{OUT}/frame-{m}.svg','w').write(frame(m,top))

# ---------- Liga-Wappen mit Billardkugel ----------
BALL={1:'#f2c230',2:'#2766c4',3:'#d23a2e',4:'#6b3fa0'}
def shield(n, metal, wings, crowned):
    W,H=220,240; cx=110
    d=f'M {cx} 34 C {cx+40} 50 {cx+62} 48 {cx+74} 44 C {cx+78} 110 {cx+62} 168 {cx} 206 C {cx-62} 168 {cx-78} 110 {cx-74} 44 C {cx-62} 48 {cx-40} 50 {cx} 34 Z'
    di=f'M {cx} 48 C {cx+34} 62 {cx+52} 60 {cx+62} 57 C {cx+64} 112 {cx+50} 160 {cx} 190 C {cx-50} 160 {cx-64} 112 {cx-62} 57 C {cx-52} 60 {cx-34} 62 {cx} 48 Z'
    b=[]
    if wings: b.append(wing(cx-48,118,-1,1.2)+wing(cx+48,118,1,1.2))
    b.append(f'<path d="{d}" fill="url(#M)" stroke="url(#M-edge)" stroke-width="2" filter="url(#shadow)"/>')
    b.append(f'<path d="{di}" fill="#1a1214" stroke="url(#M-edge)" stroke-width="1.5"/>')
    b.append(f'<path d="{di}" fill="url(#felt)" opacity=".9"/>')
    # ball
    bx,by,br=cx,116,34
    b.append(f'<circle cx="{bx}" cy="{by+4}" r="{br}" fill="rgba(0,0,0,.45)"/>')
    b.append(f'<circle cx="{bx}" cy="{by}" r="{br}" fill="{BALL[n]}"/>')
    b.append(f'<circle cx="{bx}" cy="{by}" r="{br}" fill="url(#ballshade)"/>')
    b.append(f'<circle cx="{bx}" cy="{by}" r="{br*.46}" fill="#fbf8ee"/>')
    b.append(f'<text x="{bx}" y="{by+8}" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="24" fill="#1b1b1b">{n}</text>')
    b.append(f'<ellipse cx="{bx-12}" cy="{by-15}" rx="9" ry="5" fill="rgba(255,255,255,.6)" transform="rotate(-30 {bx-12} {by-15})"/>')
    # ribbon
    b.append(f'<path d="M {cx-70} 176 L {cx+70} 176 L {cx+62} 188 L {cx+70} 200 L {cx-70} 200 L {cx-62} 188 Z" fill="url(#M)" stroke="url(#M-edge)" stroke-width="1.2" filter="url(#shadow)"/>')
    for s_ in (-1,1): b.append(f'<circle cx="{cx+s_*40}" cy="188" r="3" fill="url(#gem)"/>')
    b.append(f'<path d="M {cx-24} 188 L {cx+24} 188" stroke="#3a2408" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>')
    if crowned: b.append(crown(cx,38,62))
    else: b.append(f'<circle cx="{cx}" cy="34" r="8" fill="url(#gem)" stroke="url(#M-edge)" stroke-width="1.5"/>')
    defs='<radialGradient id="felt" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#1f6b4f"/><stop offset="1" stop-color="#0b2e22"/></radialGradient><radialGradient id="ballshade" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="rgba(255,255,255,.25)"/><stop offset=".55" stop-color="rgba(0,0,0,0)"/><stop offset="1" stop-color="rgba(0,0,0,.5)"/></radialGradient>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><defs>{metal_defs("M",metal)}{GLOW}{defs}</defs>{"".join(b)}</svg>'

for n,metal,wings,crowned in [(1,'gold',False,True),(2,'gold',False,False),(3,'silver',False,False),(4,'bronze',False,False)]:
    open(f'{OUT}/liga-{n}.svg','w').write(shield(n,metal,wings,crowned))

# ---------- Pokal ----------
def trophy():
    W,H=240,260; cx=120
    b=[]
    b.append(laurel(cx,128,96,-50,40,6,1.15))
    # handles
    for s in (1,-1):
        b.append(f'<path d="M {cx+s*52} 62 C {cx+s*98} 58 {cx+s*92} 128 {cx+s*40} 132" fill="none" stroke="url(#M)" stroke-width="11" stroke-linecap="round" filter="url(#shadow)"/>')
    cup=f'M {cx-60} 50 L {cx+60} 50 C {cx+60} 118 {cx+36} 146 {cx+12} 152 L {cx+12} 172 L {cx-12} 172 L {cx-12} 152 C {cx-36} 146 {cx-60} 118 {cx-60} 50 Z'
    b.append(f'<path d="{cup}" fill="url(#M)" stroke="url(#M-edge)" stroke-width="2" filter="url(#shadow)"/>')
    b.append(f'<ellipse cx="{cx}" cy="50" rx="60" ry="9" fill="url(#M-edge)"/><ellipse cx="{cx}" cy="49" rx="54" ry="6" fill="#3a2408"/>')
    b.append(f'<path d="M {cx-44} 60 C {cx-44} 108 {cx-30} 132 {cx-16} 140" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="5" stroke-linecap="round"/>')
    # 8-ball emblem
    b.append(f'<circle cx="{cx}" cy="96" r="22" fill="#111" stroke="url(#M-edge)" stroke-width="2"/><circle cx="{cx}" cy="96" r="10" fill="#fbf8ee"/><text x="{cx}" y="101" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="14" fill="#111">8</text><ellipse cx="{cx-8}" cy="86" rx="6" ry="3" fill="rgba(255,255,255,.35)" transform="rotate(-30 {cx-8} 86)"/>')
    # base
    b.append(f'<path d="M {cx-30} 172 L {cx+30} 172 L {cx+38} 192 L {cx-38} 192 Z" fill="url(#M)" stroke="url(#M-edge)" stroke-width="1.5"/>')
    b.append(f'<rect x="{cx-54}" y="192" width="108" height="30" rx="4" fill="#24170f" stroke="url(#M-edge)" stroke-width="2" filter="url(#shadow)"/>')
    b.append(f'<rect x="{cx-38}" y="199" width="76" height="16" rx="2" fill="url(#M)"/>')
    b.append(f'<path d="M {cx} 14 l 4 10 l 10 0 l -8 6 l 3 10 l -9 -6 l -9 6 l 3 -10 l -8 -6 l 10 0 Z" fill="url(#M)" stroke="url(#M-edge)" stroke-width="1" filter="url(#glow)"/>')
    return svg(W,H,''.join(b),'gold')
open(f'{OUT}/trophy.svg','w').write(trophy())

# ---------- Medaillen ----------
def medal(metal):
    W,H=140,170; cx,cy,R=70,104,44
    b=[]
    b.append(f'<path d="M 46 4 L 66 4 L 80 66 L 60 70 Z" fill="#1a8f84"/><path d="M 94 4 L 74 4 L 60 66 L 80 70 Z" fill="#5fe3d3"/><path d="M 46 4 L 66 4 L 70 22 L 52 26 Z" fill="rgba(0,0,0,.2)"/>')
    pts=[]
    for i in range(32):
        r=R+7 if i%2==0 else R+1; a=math.radians(i*360/32-90)
        pts.append(f'{cx+math.cos(a)*r:.1f},{cy+math.sin(a)*r:.1f}')
    b.append(f'<polygon points="{" ".join(pts)}" fill="url(#M)" stroke="url(#M-edge)" stroke-width="1.2" filter="url(#shadow)"/>')
    b.append(f'<circle cx="{cx}" cy="{cy}" r="{R-4}" fill="url(#M)" stroke="url(#M-edge)" stroke-width="2"/>')
    b.append(f'<circle cx="{cx}" cy="{cy}" r="{R-10}" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.2" stroke-dasharray="2 3"/>')
    b.append(f'<ellipse cx="{cx-14}" cy="{cy-22}" rx="14" ry="6" fill="rgba(255,255,255,.35)" transform="rotate(-30 {cx-14} {cy-22})"/>')
    return svg(W,H,''.join(b),metal)
for m in ('gold','silver','bronze'):
    open(f'{OUT}/medal-{m}.svg','w').write(medal(m))
# locked medal
open(f'{OUT}/medal-locked.svg','w').write(medal('silver').replace('#ffffff','#5a5050').replace('#e3e8ee','#4a4242').replace('#9aa5b1','#2c2626').replace('#f4f7fa','#463e3e').replace('#1a8f84','#3a3333').replace('#5fe3d3','#4d4545'))

# ---------- Strahlen ----------
def rays():
    W=H=600; cx=cy=300; b=[]
    for i in range(36):
        a1=math.radians(i*10); a2=math.radians(i*10+4.5)
        b.append(f'<path d="M {cx} {cy} L {cx+math.cos(a1)*300:.1f} {cy+math.sin(a1)*300:.1f} L {cx+math.cos(a2)*300:.1f} {cy+math.sin(a2)*300:.1f} Z" fill="url(#rg)"/>')
    import random; random.seed(4)
    for i in range(60):
        r=random.uniform(40,280); a=random.uniform(0,6.283); s=random.uniform(.6,2.4)
        b.append(f'<circle cx="{cx+math.cos(a)*r:.1f}" cy="{cy+math.sin(a)*r:.1f}" r="{s:.1f}" fill="#fff3c8" opacity="{random.uniform(.3,.9):.2f}"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><defs><radialGradient id="rg" cx="300" cy="300" r="300" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe2a0" stop-opacity=".55"/><stop offset=".6" stop-color="#e8b85f" stop-opacity=".12"/><stop offset="1" stop-color="#e8b85f" stop-opacity="0"/></radialGradient></defs>{"".join(b)}</svg>'
open(f'{OUT}/rays.svg','w').write(rays())
print(sorted(os.listdir(OUT)))
