"""Hero loop: a tangle of flight paths and jargon that collapses into the
AlreadyAirborne "A" (src/components/logo.tsx). A solid chrome A fades up
inside the outline, light sweeps across it, then it all tangles again. Seamless 8 s loop.

Each web size is rendered natively (no cropping or re-encoding), so it stays
sharp on high-density screens:
  Blender -b -P design/blender/untangle.py -- OUT_DIR desktop   # 2000x876 -> hero-untangle.mp4/.jpg
  Blender -b -P design/blender/untangle.py -- OUT_DIR phone     # 1040x900 -> hero-untangle-phone.mp4/.jpg
  Blender -b -P design/blender/untangle.py -- OUT_DIR desktop still 30,124,138   # preview frames
"""

import math
import random
import re
import sys

import bmesh
import bpy

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/untangle"
FORMAT = argv[1] if len(argv) > 1 else "desktop"
STILL = len(argv) > 2 and argv[2] == "still"

FORMATS = {
    # resolution, lens, file suffix, bitrate (kb/s)
    "desktop": ((2000, 876), 40, "", 7000),  # H.264 needs even sizes
    "phone": ((1040, 900), 56, "-phone", 4200),
}
(RES_X, RES_Y), LENS, SUFFIX, KBPS = FORMATS[FORMAT]

FPS, END = 30, 240  # frame END == frame 0: seamless loop
HOLD_FRAME = 160  # 5.33 s: the still shown before the video plays (hero-untangle.tsx HOLD)
POINTS = 220
MARK_W = 2.6  # world width of the A
K = MARK_W / 664  # logo viewBox units -> world
CX, CY = 628, 604  # centre of the logo viewBox
DEPTH = 0.16  # extrusion of the chrome A

# Same paths as src/components/logo.tsx (viewBox 296 400 664 408).
LOGO_PATHS = [
    "M628 400L770 630H704L628 505L552 630H486Z",
    "M296 555C330 568 350 590 372 602L628 642L884 602C906 590 926 568 960 555C944 592 916 622 876 630L826 652L842 668L790 662L628 690L466 662L414 668L430 652L380 630C340 622 312 592 296 555Z",
    "M471 674H533L460 808H385Z",
    "M723 674H785L871 808H796Z",
]
# The strands trace what you can see: the peak's outline stops at the wing.
OUTLINE_PATHS = ["M628 400L765 621L705 631L628 505L551 631L491 621Z"] + LOGO_PATHS[1:]
FRONT = [0.0, -0.03, 0.0, 0.0]  # the wing sits in front of the peak it crosses
STRANDS_PER_SHAPE = [10, 14, 6, 6]

COLORS = [(0x22, 0xD3, 0xEE), (0xF0, 0x48, 0xC8), (0xFB, 0xBF, 0x24), (0x4A, 0xDE, 0x80), (0xF8, 0x71, 0x71), (0xA7, 0x8B, 0xFA)]
ICE = (0x8F, 0xBE, 0xFF)
JARGON = [
    "METAR KSJC 061853Z 31012G18KT", "Vso 48 KIAS", "14 CFR 91.155", "ILS RWY 30L", "P-FACTOR",
    "DA 1,200 MSL", "MAGNETIC DIP", "Vy 74", "SIGMET WA 3", "CLASS B", "CDI 1/2 DOT",
    "DENSITY ALT 4,800", "TAF AMD", "IMSAFE", "PAPI 3.00", "VOR TO/FROM",
]

# Timeline (frames)
TANGLE_END, MERGE_END = 54, 118
LOCK = 128  # the chrome A is fully lit
HOLD_END, UNMERGE_END = 172, 226

rng = random.Random(7)


def lin(c, a=1):
    """sRGB 0-255 -> linear 0-1."""
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), a)


# --- The A as polylines -----------------------------------------------------------
def parse(d):
    """SVG path (M L H C Z, absolute) -> list of dense points in viewBox units."""
    toks = re.findall(r"[MLHCZ]|-?\d+(?:\.\d+)?", d)
    pts, i, cur, cmd = [], 0, (0.0, 0.0), None
    while i < len(toks):
        if toks[i] in "MLHCZ":
            cmd = toks[i]
            i += 1
            if cmd == "Z":
                continue
        if cmd in ("M", "L"):
            cur = (float(toks[i]), float(toks[i + 1]))
            i += 2
            pts.append(cur)
        elif cmd == "H":
            cur = (float(toks[i]), cur[1])
            i += 1
            pts.append(cur)
        elif cmd == "C":
            x1, y1, x2, y2, x, y = map(float, toks[i : i + 6])
            i += 6
            p0 = cur
            for k in range(1, 17):
                t = k / 16
                mt = 1 - t
                pts.append((
                    mt**3 * p0[0] + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t**3 * x,
                    mt**3 * p0[1] + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t**3 * y,
                ))
            cur = (x, y)
    return pts


def resample(poly, n, offset):
    """n points evenly spaced around a closed polyline, starting `offset` (0-1) of the way round."""
    loop = poly + [poly[0]]
    seg = [math.dist(loop[k], loop[k + 1]) for k in range(len(poly))]
    total = sum(seg)
    out = []
    for j in range(n):
        target = ((offset + j / (n - 1)) % 1) * total
        k = 0
        while k < len(seg) - 1 and target > seg[k]:
            target -= seg[k]
            k += 1
        t = target / seg[k] if seg[k] else 0
        a, b = loop[k], loop[k + 1]
        out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def world(p, y=0.0):
    return ((p[0] - CX) * K, y, -(p[1] - CY) * K)


SHAPES = [parse(d) for d in LOGO_PATHS]
OUTLINES = [parse(d) for d in OUTLINE_PATHS]


def tangle_point(u, p):
    a = u * math.tau
    return (
        2.2 * math.sin(p[0] * a + p[4]) + 0.55 * math.sin(p[1] * a + p[5]),
        1.6 * math.sin(p[2] * a + p[6]),
        1.3 * math.cos(p[3] * a + p[7]) + 0.32 * math.sin(p[1] * a + p[4]),
    )


def emission(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em.inputs["Color"].default_value = color
    em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs[0], out.inputs[0])
    return m, em


def key(socket, frames):
    """Keyframe a shader socket's value."""
    for f, v in frames:
        socket.default_value = v
        socket.keyframe_insert("default_value", frame=f)


def key_obj(ob, prop, frames):
    for f, v in frames:
        setattr(ob, prop, v)
        ob.keyframe_insert(prop, frame=f)


def fcurves(ob, prop):
    return [fc for fc in ob.animation_data.action.fcurves if fc.data_path == prop]


# --- Scene ------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.eevee.taa_render_samples = 48
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 0, END - 1
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = RES_X, RES_Y, 100
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"

world_ = bpy.data.worlds.new("World")
world_.use_nodes = True
world_.node_tree.nodes["Background"].inputs[0].default_value = (0, 0, 0, 1)
scene.world = world_

# --- Strands: each one traces a whole outline of the A once formed ------------------
i = 0
for shape_index, count in enumerate(STRANDS_PER_SHAPE):
    for n in range(count):
        p = [rng.uniform(1, 2.4), rng.uniform(1, 3.2), rng.uniform(1, 2.8), rng.uniform(1, 2.4)] + [rng.uniform(0, math.tau) for _ in range(4)]
        cu = bpy.data.curves.new(f"strand{i}", "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = 0.0105
        cu.bevel_resolution = 3
        sp = cu.splines.new("POLY")
        sp.points.add(POINTS - 1)
        for j, pt in enumerate(sp.points):
            pt.co = (*tangle_point(j / (POINTS - 1), p), 1)
        ob = bpy.data.objects.new(f"strand{i}", cu)
        scene.collection.objects.link(ob)

        ob.shape_key_add(name="Basis")
        sk = ob.shape_key_add(name="Mark")
        target = resample(OUTLINES[shape_index], POINTS, rng.random())
        for j, pt in enumerate(sk.data):
            pt.co = world(target[j], FRONT[shape_index] - 0.02)  # on the chrome's front edge

        base = COLORS[i % len(COLORS)]
        mat, em = emission(f"m{i}", lin(base), 2.0)
        cu.materials.append(mat)

        d = rng.randint(0, 18)  # stagger
        for f, v in [(0, 0), (TANGLE_END + d, 0), (MERGE_END - 18 + d, 1), (HOLD_END + d // 2, 1), (UNMERGE_END - 18 + d, 0), (END, 0)]:
            sk.value = v
            sk.keyframe_insert("value", frame=f)
            em.inputs["Color"].default_value = lin(ICE) if v else lin(base)
            em.inputs["Color"].keyframe_insert("default_value", frame=f)
        # Bright as they lock on, then settle into a rim light on the chrome.
        key(em.inputs["Strength"], [(0, 2.0), (TANGLE_END + d, 2.0), (MERGE_END - 6 + d // 2, 4.5), (LOCK + 14, 2.4), (HOLD_END, 2.6), (UNMERGE_END - 18 + d, 2.0), (END, 2.0)])

        ax = [rng.uniform(-0.5, 0.5) for _ in range(3)]
        for f, s in [(0, 0), (TANGLE_END, 1), (MERGE_END, 0), (HOLD_END, 0), (UNMERGE_END, -0.8), (END, 0)]:
            ob.rotation_euler = (ax[0] * s, ax[1] * s, ax[2] * s)
            ob.keyframe_insert("rotation_euler", frame=f)
        i += 1

# --- The chrome A: extruded and bevelled, fades up inside the outline -----------------
chrome = bpy.data.materials.new("chrome")
chrome.use_nodes = True
nt = chrome.node_tree
nt.nodes.clear()
tc = nt.nodes.new("ShaderNodeTexCoord")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
nt.links.new(tc.outputs["Object"], sep.inputs[0])
# Polished-chrome reflection bands along a slight diagonal.
diag = nt.nodes.new("ShaderNodeMath")
diag.operation = "MULTIPLY_ADD"
diag.inputs[1].default_value = 0.35
nt.links.new(sep.outputs["X"], diag.inputs[0])
nt.links.new(sep.outputs["Z"], diag.inputs[2])
bands = nt.nodes.new("ShaderNodeMapRange")
bands.inputs["From Min"].default_value, bands.inputs["From Max"].default_value = -0.95, 0.95
nt.links.new(diag.outputs[0], bands.inputs["Value"])
ramp = nt.nodes.new("ShaderNodeValToRGB")
els = ramp.color_ramp.elements
els[0].position, els[0].color = 0.0, lin((0x6E, 0x7C, 0x92))
els[1].position, els[1].color = 1.0, lin((0xFF, 0xFF, 0xFF))
for pos, c in [(0.28, (0xE9, 0xEE, 0xF5)), (0.42, (0x9A, 0xA7, 0xBA)), (0.6, (0xF4, 0xF7, 0xFB)), (0.78, (0xB7, 0xC2, 0xD2))]:
    e = els.new(pos)
    e.color = lin(c)
nt.links.new(bands.outputs["Result"], ramp.inputs["Fac"])
# Light sweep: a bright diagonal band that slides across during the hold.
sweep_pos = nt.nodes.new("ShaderNodeValue")
d2 = nt.nodes.new("ShaderNodeMath")
d2.operation = "MULTIPLY_ADD"
d2.inputs[1].default_value = 0.6
nt.links.new(sep.outputs["Z"], d2.inputs[0])
nt.links.new(sep.outputs["X"], d2.inputs[2])
off = nt.nodes.new("ShaderNodeMath")
off.operation = "SUBTRACT"
nt.links.new(d2.outputs[0], off.inputs[0])
nt.links.new(sweep_pos.outputs[0], off.inputs[1])
absn = nt.nodes.new("ShaderNodeMath")
absn.operation = "ABSOLUTE"
nt.links.new(off.outputs[0], absn.inputs[0])
band = nt.nodes.new("ShaderNodeMapRange")
band.inputs["From Min"].default_value, band.inputs["From Max"].default_value = 0.0, 0.12
band.inputs["To Min"].default_value, band.inputs["To Max"].default_value = 3.5, 0.0
nt.links.new(absn.outputs[0], band.inputs["Value"])
# Bevels and sides catch the light: brighter where the surface turns away.
lw = nt.nodes.new("ShaderNodeLayerWeight")
lw.inputs["Blend"].default_value = 0.35
rim = nt.nodes.new("ShaderNodeMath")
rim.operation = "MULTIPLY"
rim.inputs[1].default_value = 2.2
nt.links.new(lw.outputs["Facing"], rim.inputs[0])
s1 = nt.nodes.new("ShaderNodeMath")
s1.operation = "ADD"
s1.inputs[1].default_value = 1.0
nt.links.new(band.outputs["Result"], s1.inputs[0])
s2 = nt.nodes.new("ShaderNodeMath")
s2.operation = "ADD"
nt.links.new(s1.outputs[0], s2.inputs[0])
nt.links.new(rim.outputs[0], s2.inputs[1])
# Fade: the A glows up inside the outline the strands have drawn.
fade = nt.nodes.new("ShaderNodeMath")
fade.operation = "MULTIPLY"
nt.links.new(s2.outputs[0], fade.inputs[0])
em = nt.nodes.new("ShaderNodeEmission")
nt.links.new(ramp.outputs["Color"], em.inputs["Color"])
nt.links.new(fade.outputs[0], em.inputs["Strength"])
out = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(em.outputs[0], out.inputs[0])
key(fade.inputs[1], [(0, 0), (MERGE_END - 6, 0), (LOCK + 6, 1), (HOLD_END - 4, 1), (HOLD_END + 14, 0), (END, 0)])
key(sweep_pos.outputs[0], [(0, -2.2), (LOCK + 8, -2.2), (HOLD_END - 2, 2.2), (END, 2.2)])

pivot = bpy.data.objects.new("A", None)
scene.collection.objects.link(pivot)
for s, poly in enumerate(SHAPES):
    bm = bmesh.new()
    face = bm.faces.new([bm.verts.new(world(q, FRONT[s])) for q in poly])
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    back = [v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=back, vec=(0, DEPTH, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(f"A{s}")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(f"A{s}", me)
    me.materials.append(chrome)
    scene.collection.objects.link(ob)
    ob.parent = pivot
    bev = ob.modifiers.new("bevel", "BEVEL")
    bev.width, bev.segments, bev.limit_method = 0.014, 3, "ANGLE"

# Hidden (scaled to nothing) whenever it isn't showing, so the unlit chrome
# never blocks strands passing behind it.
SHOW, HIDE = MERGE_END - 7, HOLD_END + 15
key_obj(pivot, "scale", [(0, (0.0001,) * 3), (SHOW - 1, (0.0001,) * 3), (SHOW, (1,) * 3), (HIDE, (1,) * 3), (HIDE + 1, (0.0001,) * 3), (END, (0.0001,) * 3)])
for fc in fcurves(pivot, "scale"):
    for kp in fc.keyframe_points:
        if kp.co[0] in (0, SHOW - 1, HIDE, HIDE + 1):
            kp.interpolation = "CONSTANT"

# --- Soft blue bloom behind the A ---------------------------------------------------
halo = bpy.data.materials.new("halo")
halo.use_nodes = True
h = halo.node_tree
h.nodes.clear()
htc = h.nodes.new("ShaderNodeTexCoord")
hflat = h.nodes.new("ShaderNodeVectorMath")
hflat.operation = "MULTIPLY"
hflat.inputs[1].default_value = (1, 1.5, 0)
h.links.new(htc.outputs["Object"], hflat.inputs[0])
hlen = h.nodes.new("ShaderNodeVectorMath")
hlen.operation = "LENGTH"
h.links.new(hflat.outputs[0], hlen.inputs[0])
hmap = h.nodes.new("ShaderNodeMapRange")
hmap.inputs["From Min"].default_value, hmap.inputs["From Max"].default_value = 0.0, 0.5
hmap.inputs["To Min"].default_value, hmap.inputs["To Max"].default_value = 1.0, 0.0
hmap.interpolation_type = "SMOOTHERSTEP"
h.links.new(hlen.outputs["Value"], hmap.inputs["Value"])
hmul = h.nodes.new("ShaderNodeMath")
hmul.operation = "MULTIPLY"
h.links.new(hmap.outputs["Result"], hmul.inputs[0])
key(hmul.inputs[1], [(0, 0.03), (MERGE_END - 10, 0.06), (LOCK + 10, 0.16), (HOLD_END, 0.14), (UNMERGE_END, 0.03), (END, 0.03)])
hem = h.nodes.new("ShaderNodeEmission")
hem.inputs["Color"].default_value = lin((0x2A, 0x5C, 0xC8))
h.links.new(hmul.outputs[0], hem.inputs["Strength"])
# Additive: light on top of the dot grid instead of an opaque plane in front of it.
hclear = h.nodes.new("ShaderNodeBsdfTransparent")
hadd = h.nodes.new("ShaderNodeAddShader")
h.links.new(hclear.outputs[0], hadd.inputs[0])
h.links.new(hem.outputs[0], hadd.inputs[1])
hout = h.nodes.new("ShaderNodeOutputMaterial")
h.links.new(hadd.outputs[0], hout.inputs[0])
if hasattr(halo, "surface_render_method"):
    halo.surface_render_method = "BLENDED"
glow_mesh = bpy.data.meshes.new("glow")
glow_mesh.from_pydata([(-0.5, 0, -0.5), (0.5, 0, -0.5), (0.5, 0, 0.5), (-0.5, 0, 0.5)], [], [[0, 1, 2, 3]])
glow = bpy.data.objects.new("glow", glow_mesh)
scene.collection.objects.link(glow)
glow.location = (0, 1.5, 0)
glow.scale = (9, 1, 6)
glow_mesh.materials.append(halo)
# Object coords on this plane run x/z; the halo shader expects x/y, so swap.
hswap = h.nodes.new("ShaderNodeSeparateXYZ")
hcomb = h.nodes.new("ShaderNodeCombineXYZ")
h.links.new(htc.outputs["Object"], hswap.inputs[0])
h.links.new(hswap.outputs["X"], hcomb.inputs["X"])
h.links.new(hswap.outputs["Z"], hcomb.inputs["Y"])
h.links.new(hcomb.outputs[0], hflat.inputs[0])

# --- Dot grid backdrop (as in the logo artwork) ---------------------------------------
grid = bpy.data.materials.new("grid")
grid.use_nodes = True
g = grid.node_tree
g.nodes.clear()
gtc = g.nodes.new("ShaderNodeTexCoord")
gmap = g.nodes.new("ShaderNodeMapping")
gmap.inputs["Scale"].default_value = (26 * 2.2, 16 * 2.2, 1)  # ~2.2 dots per world unit
g.links.new(gtc.outputs["Object"], gmap.inputs[0])
frac = g.nodes.new("ShaderNodeVectorMath")
frac.operation = "FRACTION"
g.links.new(gmap.outputs[0], frac.inputs[0])
cen = g.nodes.new("ShaderNodeVectorMath")
cen.operation = "SUBTRACT"
cen.inputs[1].default_value = (0.5, 0.5, 0.5)
g.links.new(frac.outputs[0], cen.inputs[0])
flat = g.nodes.new("ShaderNodeVectorMath")
flat.operation = "MULTIPLY"
flat.inputs[1].default_value = (1, 1, 0)  # ignore the plane's normal axis so dots are round
g.links.new(cen.outputs[0], flat.inputs[0])
ln = g.nodes.new("ShaderNodeVectorMath")
ln.operation = "LENGTH"
g.links.new(flat.outputs[0], ln.inputs[0])
dot = g.nodes.new("ShaderNodeMapRange")
dot.inputs["From Min"].default_value, dot.inputs["From Max"].default_value = 0.014, 0.034
dot.inputs["To Min"].default_value, dot.inputs["To Max"].default_value = 0.3, 0.0
g.links.new(ln.outputs["Value"], dot.inputs["Value"])
gem = g.nodes.new("ShaderNodeEmission")
gem.inputs["Color"].default_value = lin((0x9D, 0xB8, 0xE8))
g.links.new(dot.outputs["Result"], gem.inputs["Strength"])
gout = g.nodes.new("ShaderNodeOutputMaterial")
g.links.new(gem.outputs[0], gout.inputs[0])
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 5.0, 0), rotation=(math.pi / 2, 0, 0))
backdrop = bpy.context.active_object
backdrop.scale = (26, 16, 1)
backdrop.data.materials.append(grid)

# --- Jargon -------------------------------------------------------------------
font = bpy.data.fonts.load("/System/Library/Fonts/SFNSMono.ttf")
tmat, _ = emission("jargon", (0.8, 0.86, 0.95, 1), 1.1)
for i, text in enumerate(JARGON):
    td = bpy.data.curves.new(f"t{i}", "FONT")
    td.body = text
    td.font = font
    td.size = 0.13
    td.align_x = "CENTER"
    td.materials.append(tmat)
    ob = bpy.data.objects.new(f"t{i}", td)
    scene.collection.objects.link(ob)
    ob.rotation_euler = (math.pi / 2, 0, 0)
    a = i / len(JARGON) * math.tau + rng.uniform(-0.2, 0.2)
    r = rng.uniform(1.3, 2.4)
    home = (r * math.cos(a) * 1.25, rng.uniform(-1.5, 1.2), r * math.sin(a) * 0.6)
    away = (home[0] * 1.6, home[1] - 2.5, home[2] * 1.6)
    d = rng.randint(0, 14)
    for f, loc, s in [(0, home, 1), (TANGLE_END - 6 + d, home, 1), (TANGLE_END + 26 + d, away, 0), (UNMERGE_END - 34 + d, away, 0), (UNMERGE_END + d // 2, home, 1), (END, home, 1)]:
        ob.location = loc
        ob.scale = (s, s, s)
        ob.keyframe_insert("location", frame=f)
        ob.keyframe_insert("scale", frame=f)

# --- Camera: centred on the A, slow push in ------------------------------------------
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = LENS
cam_data.sensor_fit = "HORIZONTAL"
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.rotation_euler = (math.pi / 2, 0, 0)
for f, y in [(0, -12.0), (TANGLE_END, -11.4), (MERGE_END, -9.4), (HOLD_END, -9.0), (UNMERGE_END, -11.4), (END, -12.0)]:
    cam.location = (0, y, 0)
    cam.keyframe_insert("location", frame=f)

# --- Glow (compositor) -----------------------------------------------------------
scene.use_nodes = True
nt = scene.node_tree
nt.nodes.clear()
rl = nt.nodes.new("CompositorNodeRLayers")
glare = nt.nodes.new("CompositorNodeGlare")
glare.glare_type = "BLOOM" if "BLOOM" in [e.identifier for e in glare.bl_rna.properties["glare_type"].enum_items] else "FOG_GLOW"
glare.quality = "HIGH"
for name, val in (("Threshold", 1.3), ("Size", 0.45), ("Strength", 0.75)):
    if name in glare.inputs:
        glare.inputs[name].default_value = val
if hasattr(glare, "threshold") and "Threshold" not in glare.inputs:
    glare.threshold, glare.size = 1.3, 7
comp = nt.nodes.new("CompositorNodeComposite")
nt.links.new(rl.outputs["Image"], glare.inputs["Image"])
nt.links.new(glare.outputs["Image"], comp.inputs["Image"])

# --- Output ------------------------------------------------------------------------
r = scene.render
if STILL:
    for f in map(int, argv[3].split(",")) if len(argv) > 3 else [HOLD_FRAME]:
        scene.frame_set(f)
        r.image_settings.file_format = "JPEG"
        r.image_settings.quality = 92
        r.filepath = f"{OUT}/{FORMAT}-{f}.jpg"
        bpy.ops.render.render(write_still=True)
else:
    r.image_settings.file_format = "FFMPEG"
    r.ffmpeg.format = "MPEG4"
    r.ffmpeg.codec = "H264"
    r.ffmpeg.constant_rate_factor = "NONE"
    r.ffmpeg.video_bitrate = KBPS
    r.ffmpeg.maxrate = KBPS * 3 // 2
    r.ffmpeg.minrate = 0
    r.ffmpeg.buffersize = KBPS * 3 // 2
    r.ffmpeg.ffmpeg_preset = "BEST"
    r.ffmpeg.gopsize = 30
    r.ffmpeg.audio_codec = "NONE"
    r.filepath = f"{OUT}/hero-untangle{SUFFIX}.mp4"
    bpy.ops.render.render(animation=True)
    # The still the page shows before the video plays.
    scene.frame_set(HOLD_FRAME)
    r.image_settings.file_format = "JPEG"
    r.image_settings.quality = 92
    r.filepath = f"{OUT}/hero-untangle{SUFFIX}.jpg"
    bpy.ops.render.render(write_still=True)
