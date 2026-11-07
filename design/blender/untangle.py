"""Hero loop: a tangle of flight paths and jargon that collapses into the
AlreadyAirborne flight path marker, holds, then tangles again. Seamless 8 s loop.

Render (from the repo root):
  /Applications/Blender.app/Contents/MacOS/Blender -b -P design/blender/untangle.py -- OUT_DIR [still]
"""

import math
import random
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/untangle"
STILL = len(argv) > 1 and argv[1] == "still"

FPS, END = 30, 240  # frame END == frame 0: seamless loop
STRANDS, POINTS = 30, 160
MARK_W = 3.2  # world width of the mark
K = MARK_W / 34  # logo viewBox units -> world

COLORS = [(0x22, 0xD3, 0xEE), (0xF0, 0x48, 0xC8), (0xFB, 0xBF, 0x24), (0x4A, 0xDE, 0x80), (0xF8, 0x71, 0x71), (0xA7, 0x8B, 0xFA)]
GREEN = (0x4A, 0xDE, 0x80)
JARGON = [
    "METAR KSJC 061853Z 31012G18KT", "Vso 48 KIAS", "14 CFR 91.155", "ILS RWY 30L", "P-FACTOR",
    "DA 1,200 MSL", "MAGNETIC DIP", "Vy 74", "SIGMET WA 3", "CLASS B", "CDI 1/2 DOT",
    "DENSITY ALT 4,800", "TAF AMD", "IMSAFE", "PAPI 3.00", "VOR TO/FROM",
]

# Timeline (frames)
TANGLE_END, MERGE_END = 54, 118
HOLD_END, UNMERGE_END = 172, 226

rng = random.Random(7)


def lin(c):
    """sRGB 0-255 -> linear 0-1."""
    def f(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1)


def mark_point(u, variant):
    """Point at u along the logo (34x20 viewBox, y down), centred on the ring, in world XZ."""
    if variant == 2:
        x, y = 17, 1 + u * 5
    elif u < 0.3:
        x, y = 2 + u / 0.3 * 10, 11
    elif u > 0.7:
        x, y = 22 + (u - 0.7) / 0.3 * 10, 11
    else:
        a = math.pi * (1 - (u - 0.3) / 0.4)
        x, y = 17 + 5 * math.cos(a), 11 - (1 if variant == 0 else -1) * 5 * math.sin(a)
    return ((x - 17) * K, 0.0, -(y - 11) * K)


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


# --- Scene ------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.eevee.taa_render_samples = 24
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 0, END - 1
scene.render.resolution_x, scene.render.resolution_y = 1600, 900
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"

world = bpy.data.worlds.new("World")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0, 0, 0, 1)
scene.world = world

# --- Strands ------------------------------------------------------------------
for i in range(STRANDS):
    variant = 2 if i % 6 == 5 else i % 2
    p = [rng.uniform(1, 2.6), rng.uniform(1, 3.5), rng.uniform(1, 3), rng.uniform(1, 2.6)] + [rng.uniform(0, math.tau) for _ in range(4)]

    cu = bpy.data.curves.new(f"strand{i}", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.009
    cu.bevel_resolution = 2
    sp = cu.splines.new("POLY")
    sp.points.add(POINTS - 1)
    for j, pt in enumerate(sp.points):
        pt.co = (*tangle_point(j / (POINTS - 1), p), 1)
    ob = bpy.data.objects.new(f"strand{i}", cu)
    scene.collection.objects.link(ob)

    ob.shape_key_add(name="Basis")
    sk = ob.shape_key_add(name="Mark")
    for j, pt in enumerate(sk.data):
        pt.co = mark_point(j / (POINTS - 1), variant)

    base = COLORS[i % len(COLORS)]
    mat, em = emission(f"m{i}", lin(base), 1.6)
    cu.materials.append(mat)

    d = rng.randint(0, 16)  # stagger
    for f, v in [(0, 0), (TANGLE_END + d, 0), (MERGE_END - 16 + d, 1), (HOLD_END + d // 2, 1), (UNMERGE_END - 18 + d, 0), (END, 0)]:
        sk.value = v
        sk.keyframe_insert("value", frame=f)
        em.inputs["Color"].default_value = lin(GREEN) if v else lin(base)
        em.inputs["Color"].keyframe_insert("default_value", frame=f)
        em.inputs["Strength"].default_value = 6.0 if v else 1.6
        em.inputs["Strength"].keyframe_insert("default_value", frame=f)

    # Slow swirl while tangled, square to camera while it's the mark.
    ax = [rng.uniform(-0.5, 0.5) for _ in range(3)]
    for f, s in [(0, 0), (TANGLE_END, 1), (MERGE_END, 0), (HOLD_END, 0), (UNMERGE_END, -0.8), (END, 0)]:
        ob.rotation_euler = (ax[0] * s, ax[1] * s, ax[2] * s)
        ob.keyframe_insert("rotation_euler", frame=f)

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

# --- Camera ---------------------------------------------------------------------
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 40
cam_data.shift_x = -0.17  # subject sits right of centre; copy goes on the left
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.rotation_euler = (math.pi / 2, 0, 0)
for f, y in [(0, -11.5), (TANGLE_END, -11.0), (MERGE_END, -8.6), (HOLD_END, -8.3), (UNMERGE_END, -11.0), (END, -11.5)]:
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
comp = nt.nodes.new("CompositorNodeComposite")
nt.links.new(rl.outputs["Image"], glare.inputs["Image"])
nt.links.new(glare.outputs["Image"], comp.inputs["Image"])

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
