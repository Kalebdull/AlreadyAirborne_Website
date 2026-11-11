# Web cuts of the hero loop: crops the full render around the A and re-encodes
# it small. Writes the video and a still at the HOLD frame.
#   phone:   Blender -b --factory-startup -P design/blender/phone_cut.py -- RENDER.mp4 public/hero-untangle-phone.mp4 public/hero-untangle-phone.jpg
#   desktop: ... -- RENDER.mp4 public/hero-untangle.mp4 public/hero-untangle.jpg 1600 700 1 2600
import bpy, sys
args = sys.argv[sys.argv.index("--")+1:]
src, out, still = args[:3]
W, H, S, KBPS = (int(args[3]), int(args[4]), float(args[5]), int(args[6])) if len(args) > 3 else (832, 720, 0.8, 1100)
sc = bpy.context.scene
sc.sequence_editor_create()
st = sc.sequence_editor.sequences.new_movie("v", src, 1, 1)
sc.render.fps = 30
sc.frame_start, sc.frame_end = 1, st.frame_final_duration
CX, CY = 800, 450  # the A is centred in the frame
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
st.transform.scale_x = st.transform.scale_y = S
st.transform.offset_x = -(CX - 800) * S
st.transform.offset_y = (CY - 450) * S
sc.render.use_sequencer = True
sc.view_settings.view_transform = "Standard"
r = sc.render
r.image_settings.file_format = "FFMPEG"
r.ffmpeg.format = "MPEG4"; r.ffmpeg.codec = "H264"
r.ffmpeg.constant_rate_factor = "NONE"; r.ffmpeg.video_bitrate = KBPS; r.ffmpeg.maxrate = KBPS * 16 // 10; r.ffmpeg.minrate = 0; r.ffmpeg.buffersize = KBPS * 16 // 10; r.ffmpeg.ffmpeg_preset = "BEST"; r.ffmpeg.gopsize = 30; r.ffmpeg.audio_codec = "NONE"
r.filepath = out
bpy.ops.render.render(animation=True)
r.image_settings.file_format = "JPEG"; r.image_settings.quality = 85
sc.frame_set(1 + round(4.6 * 30))
r.filepath = still
bpy.ops.render.render(write_still=True)
