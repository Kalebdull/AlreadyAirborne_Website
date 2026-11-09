# Phone cut of the hero loop: crops public/hero-untangle.mp4 around the marker
# and re-encodes it small. Writes the video and a still at the HOLD frame.
#   Blender -b --factory-startup -P design/blender/phone_cut.py -- public/hero-untangle.mp4 public/hero-untangle-phone.mp4 public/hero-untangle-phone.jpg
import bpy, sys
src, out, still = sys.argv[sys.argv.index("--")+1:]
sc = bpy.context.scene
sc.sequence_editor_create()
st = sc.sequence_editor.sequences.new_movie("v", src, 1, 1)
sc.render.fps = 30
sc.frame_start, sc.frame_end = 1, st.frame_final_duration
W, H, S, CX, CY = 832, 720, 0.8, 1071, 450
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
st.transform.scale_x = st.transform.scale_y = S
st.transform.offset_x = -(CX - 800) * S
st.transform.offset_y = (CY - 450) * S
sc.render.use_sequencer = True
sc.view_settings.view_transform = "Standard"
r = sc.render
r.image_settings.file_format = "FFMPEG"
r.ffmpeg.format = "MPEG4"; r.ffmpeg.codec = "H264"
r.ffmpeg.constant_rate_factor = "NONE"; r.ffmpeg.video_bitrate = 1100; r.ffmpeg.maxrate = 1800; r.ffmpeg.minrate = 0; r.ffmpeg.buffersize = 1800; r.ffmpeg.ffmpeg_preset = "BEST"; r.ffmpeg.gopsize = 30; r.ffmpeg.audio_codec = "NONE"
r.filepath = out
bpy.ops.render.render(animation=True)
r.image_settings.file_format = "JPEG"; r.image_settings.quality = 85
sc.frame_set(1 + round(4.6 * 30))
r.filepath = still
bpy.ops.render.render(write_still=True)
