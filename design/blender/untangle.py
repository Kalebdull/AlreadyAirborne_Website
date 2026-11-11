"""Hero loop: a tangle of flight paths and jargon that collapses into the
AlreadyAirborne "A" (src/components/logo.tsx), holds while a light sweep
glints across it, then tangles again. Seamless 8 s loop.

Render (from the repo root):
  /Applications/Blender.app/Contents/MacOS/Blender -b -P design/blender/untangle.py -- OUT_DIR [still [FRAMES]]
"""

import math
import random
import re
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/untangle"
STILL = len(argv) > 1 and argv[1] == "still"

FPS, END = 30, 240  # frame END == frame 0: seamless loop
POINTS = 200
MARK_W = 2.9  # world width of the A
K = MARK_W / 664  # logo viewBox units -> world
CX, CY = 628, 604  # centre of the logo viewBox

# Same paths as src/components/logo.tsx (viewBox 296 400 664 408).
LOGO_PATHS = [
    "M628 400L770 630H704L628 505L552 630H486Z",
    "M296 555C330 568 350 590 372 602L628 642L884 602C906 590 926 568 960 555C944 592 916 622 876 630L826 652L842 668L790 662L628 690L466 662L414 668L430 652L380 630C340 622 312 592 296 555Z",
    "M471 674H533L460 808H385Z",
    "M723 674H785L871 808H796Z",
]
# The strands trace what you can see: the peak's outline stops at the wing.
OUTLINE_PATHS = ["M628 400L765 621L705 631L628 505L551 631L491 621Z"] + LOGO_PATHS[1:]
STRANDS_PER_SHAPE = [12, 16, 7, 7]  # 42 strands, most on the wing

COLORS = [(0x22, 0xD3, 0xEE), (0xF0, 0x48, 0xC8), (0xFB, 0xBF, 0x24), (0x4A, 0xDE, 0x80), (0xF8, 0x71, 0x71), (0xA7, 0x8B, 0xFA)]
ICE = (0x8F, 0xBE, 0xFF)  # the rim glow once the A has formed
JARGON = [
    "METAR KSJC 061853Z 31012G18KT", "Vso 48 KIAS", "14 CFR 91.155", "ILS RWY 30L", "P-FACTOR",
    "DA 1,200 MSL", "MAGNETIC DIP", "Vy 74", "SIGMET WA 3", "CLASS B", "CDI 1/2 DOT",
    "DENSITY ALT 4,800", "TAF AMD", "IMSAFE", "PAPI 3.00", "VOR TO/FROM",
]

# Timeline (frames)
TANGLE_END, MERGE_END = 54, 118
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
        2.3 * math.sin(p[0] * a + p[4]) + 0.6 * math.sin(p[1] * a + p[5]),
        1.6 * math.sin(p[2] * a + p[6]),
        1.35 * math.cos(p[3] * a + p[7]) + 0.35 * math.sin(p[1] * a + p[4]),
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


# --- Scene ------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.eevee.taa_render_samples = 32
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 0, END - 1
scene.render.resolution_x, scene.render.resolution_y = 1600, 900
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
        p = [rng.uniform(1, 2.6), rng.uniform(1, 3.5), rng.uniform(1, 3), rng.uniform(1, 2.6)] + [rng.uniform(0, math.tau) for _ in range(4)]
        cu = bpy.data.curves.new(f"strand{i}", "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = 0.0075
        cu.bevel_resolution = 2
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
            pt.co = world(target[j], -0.012)  # just in front of the silver fill

        base = COLORS[i % len(COLORS)]
        mat, em = emission(f"m{i}", lin(base), 1.6)
        cu.materials.append(mat)

        d = rng.randint(0, 18)  # stagger
        for f, v in [(0, 0), (TANGLE_END + d, 0), (MERGE_END - 18 + d, 1), (HOLD_END + d // 2, 1), (UNMERGE_END - 18 + d, 0), (END, 0)]:
            sk.value = v
            sk.keyframe_insert("value", frame=f)
            em.inputs["Color"].default_value = lin(ICE) if v else lin(base)
            em.inputs["Color"].keyframe_insert("default_value", frame=f)
            em.inputs["Strength"].default_value = 5.0 if v else 1.6
            em.inputs["Strength"].keyframe_insert("default_value", frame=f)

        # Slow swirl while tangled, square to camera while it's the A.
        ax = [rng.uniform(-0.5, 0.5) for _ in range(3)]
        for f, s in [(0, 0), (TANGLE_END, 1), (MERGE_END, 0), (HOLD_END, 0), (UNMERGE_END, -0.8), (END, 0)]:
            ob.rotation_euler = (ax[0] * s, ax[1] * s, ax[2] * s)
            ob.keyframe_insert("rotation_euler", frame=f)
        i += 1

# --- The silver A: fills in once the strands have formed its outline ----------------
fill = bpy.data.materials.new("silver")
fill.use_nodes = True
nt = fill.node_tree
nt.nodes.clear()
tc = nt.nodes.new("ShaderNodeTexCoord")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
nt.links.new(tc.outputs["Object"], sep.inputs[0])
# Brushed-silver gradient, bright at the peak, cooler at the feet.
ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = 0.0, lin((0x9A, 0xA8, 0xBC))
ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = 1.0, lin((0xFF, 0xFF, 0xFF))
mid = ramp.color_ramp.elements.new(0.55)
mid.color = lin((0xD4, 0xDD, 0xEA))
zmap = nt.nodes.new("ShaderNodeMapRange")
zmap.inputs["From Min"].default_value, zmap.inputs["From Max"].default_value = -0.85, 0.85
nt.links.new(sep.outputs["Z"], zmap.inputs["Value"])
nt.links.new(zmap.outputs["Result"], ramp.inputs["Fac"])
# Light sweep: a diagonal band that slides across during the hold.
diag = nt.nodes.new("ShaderNodeMath")
diag.operation = "MULTIPLY_ADD"
diag.inputs[1].default_value = 0.55
nt.links.new(sep.outputs["Z"], diag.inputs[0])
nt.links.new(sep.outputs["X"], diag.inputs[2])
sweep_pos = nt.nodes.new("ShaderNodeValue")
off = nt.nodes.new("ShaderNodeMath")
off.operation = "SUBTRACT"
nt.links.new(diag.outputs[0], off.inputs[0])
nt.links.new(sweep_pos.outputs[0], off.inputs[1])
band = nt.nodes.new("ShaderNodeMapRange")
band.inputs["From Min"].default_value, band.inputs["From Max"].default_value = 0.0, 0.16
band.inputs["To Min"].default_value, band.inputs["To Max"].default_value = 4.5, 0.0
absn = nt.nodes.new("ShaderNodeMath")
absn.operation = "ABSOLUTE"
nt.links.new(off.outputs[0], absn.inputs[0])
nt.links.new(absn.outputs[0], band.inputs["Value"])
strength = nt.nodes.new("ShaderNodeMath")
strength.operation = "ADD"
strength.inputs[1].default_value = 1.05
nt.links.new(band.outputs["Result"], strength.inputs[0])
fade = nt.nodes.new("ShaderNodeMath")
fade.operation = "MULTIPLY"
nt.links.new(strength.outputs[0], fade.inputs[0])
em = nt.nodes.new("ShaderNodeEmission")
nt.links.new(ramp.outputs["Color"], em.inputs["Color"])
nt.links.new(fade.outputs[0], em.inputs["Strength"])
out = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(em.outputs[0], out.inputs[0])

key(fade.inputs[1], [(0, 0), (MERGE_END - 12, 0), (MERGE_END + 8, 1), (HOLD_END - 6, 1), (HOLD_END + 12, 0), (END, 0)])
key(sweep_pos.outputs[0], [(0, -2.4), (MERGE_END + 6, -2.4), (HOLD_END - 4, 2.4), (END, 2.4)])

fill_ob = None
for s, poly in enumerate(SHAPES):
    me = bpy.data.meshes.new(f"A{s}")
    me.from_pydata([world(q, 0.0) for q in poly], [], [list(range(len(poly)))])
    ob = bpy.data.objects.new(f"A{s}", me)
    me.materials.append(fill)
    scene.collection.objects.link(ob)
    # Out of the way (scaled to nothing) whenever it isn't showing, so the
    # black, unlit fill never hides strands passing behind it.
    for f, sc in [(0, 0.0001), (MERGE_END - 13, 0.0001), (MERGE_END - 12, 1), (HOLD_END + 12, 1), (HOLD_END + 13, 0.0001), (END, 0.0001)]:
        ob.scale = (sc, sc, sc)
        ob.keyframe_insert("scale", frame=f)
    for fc in ob.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "CONSTANT"

# --- Horizon flare: a blue streak and a star at the wing's centre as the A locks in -
wing_y = world((CX, 642))[2]
flare_mat, flare_em = emission("flare", lin((0x6E, 0xA8, 0xFF)), 0)
key(flare_em.inputs["Strength"], [(0, 0), (MERGE_END - 4, 0), (MERGE_END + 6, 14), (MERGE_END + 30, 3), (HOLD_END, 1.5), (HOLD_END + 14, 0), (END, 0)])
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.03, wing_y), rotation=(math.pi / 2, 0, 0))
streak = bpy.context.active_object
streak.scale = (9.0, 0.006, 1)
streak.data.materials.append(flare_mat)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, location=(0, -0.04, wing_y))
bpy.context.active_object.data.materials.append(flare_mat)

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
# Ignore the plane's normal axis so dots are round.
flat = g.nodes.new("ShaderNodeVectorMath")
flat.operation = "MULTIPLY"
flat.inputs[1].default_value = (1, 1, 0)
g.links.new(cen.outputs[0], flat.inputs[0])
ln = g.nodes.new("ShaderNodeVectorMath")
ln.operation = "LENGTH"
g.links.new(flat.outputs[0], ln.inputs[0])
dot = g.nodes.new("ShaderNodeMapRange")
dot.inputs["From Min"].default_value, dot.inputs["From Max"].default_value = 0.012, 0.03
dot.inputs["To Min"].default_value, dot.inputs["To Max"].default_value = 0.32, 0.0
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
tmat, _ = emission("jargon", (0.8, 0.86, 0.95, 1), 0.9)
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
    r = rng.uniform(1.4, 2.6)
    home = (r * math.cos(a) * 1.25, rng.uniform(-1.5, 1.5), r * math.sin(a) * 0.62)
    away = (home[0] * 1.6, home[1] - 2.5, home[2] * 1.6)
    d = rng.randint(0, 14)
    for f, loc, s in [(0, home, 1), (TANGLE_END - 6 + d, home, 1), (TANGLE_END + 26 + d, away, 0), (UNMERGE_END - 34 + d, away, 0), (UNMERGE_END + d // 2, home, 1), (END, home, 1)]:
        ob.location = loc
        ob.scale = (s, s, s)
        ob.keyframe_insert("location", frame=f)
        ob.keyframe_insert("scale", frame=f)

# --- Camera: centred on the A ---------------------------------------------------------
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 40
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.rotation_euler = (math.pi / 2, 0, 0)
for f, y in [(0, -11.5), (TANGLE_END, -11.0), (MERGE_END, -8.4), (HOLD_END, -8.0), (UNMERGE_END, -11.0), (END, -11.5)]:
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
for name, val in (("Threshold", 1.2), ("Size", 0.5), ("Strength", 0.8)):
    if name in glare.inputs:
        glare.inputs[name].default_value = val
if hasattr(glare, "threshold") and "Threshold" not in glare.inputs:
    glare.threshold, glare.size = 1.2, 7
# A second, streaky pass gives the flare its horizontal lens streak.
streaks = nt.nodes.new("CompositorNodeGlare")
streaks.glare_type = "STREAKS"
streaks.quality = "HIGH"
for name, val in (("Threshold", 6.0), ("Strength", 0.6), ("Streaks", 2), ("Streak Length", 0.4)):
    if name in streaks.inputs:
        streaks.inputs[name].default_value = val
if hasattr(streaks, "streaks") and "Streaks" not in streaks.inputs:
    streaks.threshold, streaks.streaks, streaks.angle_offset, streaks.fade = 6.0, 2, 0.0, 0.9
comp = nt.nodes.new("CompositorNodeComposite")
nt.links.new(rl.outputs["Image"], glare.inputs["Image"])
nt.links.new(glare.outputs["Image"], streaks.inputs["Image"])
nt.links.new(streaks.outputs["Image"], comp.inputs["Image"])

# --- Output ------------------------------------------------------------------------
if STILL:
    for f in map(int, argv[2].split(",")) if len(argv) > 2 else [MERGE_END + 20]:
        scene.frame_set(f)
        scene.render.image_settings.file_format = "JPEG"
        scene.render.filepath = f"{OUT}/still-{f}.jpg"
        bpy.ops.render.render(write_still=True)
else:
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "VERYLOW"
    scene.render.ffmpeg.ffmpeg_preset = "BEST"
    scene.render.ffmpeg.gopsize = 30
    scene.render.ffmpeg.audio_codec = "NONE"
    scene.render.filepath = f"{OUT}/untangle.mp4"
    bpy.ops.render.render(animation=True)
