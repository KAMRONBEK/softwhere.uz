"""Turn a recorded clip into a framed, captioned walkthrough video (and framed stills).

Usage:
  python3 build.py walkthrough.json [--out walkthrough.mp4] [--size 1920x1080]
      [--model kokoro-q8.onnx --voices <kokoro-js voices dir | voices.npz> [--voice af_heart]]
      [--stills 6,14,30] [--fonts <dir with the .woff2 files>]

walkthrough.json (see assets/walkthrough.example.json) names the clip, the device frame,
the title and the caption segments. Segment and redaction times are seconds of the
original recording (the same clock as record-web.js's timeline.json). Steps:
  1. trim the clip, blur every "redact" box, and extract 30 fps frames
  2. write config.js next to a copy of assets/walkthrough.html
  3. speak each segment's "say" text (or its caption) with Kokoro, if --model is given
  4. render the page with ../../social-video/scripts/render.js
  5. mux the voice (EBU R128 -16 LUFS) or keep it silent, +faststart
Without --model the video is silent with captions, which is what a website loop wants.
"""

import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
RENDER = os.path.join(SKILL, '..', 'social-video', 'scripts', 'render.js')


def ffmpeg():
    if os.environ.get('FFMPEG'):
        return os.environ['FFMPEG']
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


def probe(path):
    """Width, height and duration of a video, read from ffmpeg's banner."""
    r = subprocess.run([ffmpeg(), '-hide_banner', '-i', path], capture_output=True, text=True)
    size = re.search(r'Video:.*?(\d{2,5})x(\d{2,5})', r.stderr)
    dur = re.search(r'Duration: (\d+):(\d+):([\d.]+)', r.stderr)
    if not size:
        sys.exit(f'Could not read the video size of {path}')
    seconds = int(dur.group(1)) * 3600 + int(dur.group(2)) * 60 + float(dur.group(3)) if dur else None
    return int(size.group(1)), int(size.group(2)), seconds


def prepare_frames(cfg, base, work, fps):
    clip = os.path.join(base, cfg['clip'])
    w, h, dur = probe(clip)
    start = float(cfg.get('clipStart', 0))
    end = float(cfg.get('clipEnd', dur or 0)) or dur
    # Redactions are given as fractions of the clip (x, y, w, h in 0..1) and clip seconds.
    chains, last = [], '0:v'
    for i, r in enumerate(cfg.get('redact', [])):
        x, y = int(r['x'] * w), int(r['y'] * h)
        rw, rh = max(2, int(r['w'] * w)), max(2, int(r['h'] * h))
        when = f":enable='between(t,{r.get('from', 0)},{r.get('to', 1e9)})'"
        # The blur radius must fit the (half-size) chroma planes of a small box.
        radius = max(2, min(24, min(rw, rh) // 4))
        chains.append(f'[0:v]crop={rw}:{rh}:{x}:{y},boxblur={radius}:3[b{i}]')
        chains.append(f'[{last}][b{i}]overlay={x}:{y}{when}[v{i}]')
        last = f'v{i}'
    frames = os.path.join(work, 'frames')
    shutil.rmtree(frames, ignore_errors=True)
    os.makedirs(frames)
    vf = f'[{last}]fps={fps},scale=trunc(iw/2)*2:trunc(ih/2)*2[out]'
    graph = ';'.join(chains + [vf]) if chains else vf.replace(f'[{last}]', '[0:v]')
    cmd = [ffmpeg(), '-loglevel', 'error', '-y', '-i', clip, '-filter_complex', graph, '-map', '[out]']
    # Trim after filtering so redaction times stay in the original clip's seconds.
    cmd += ['-ss', str(start), '-to', str(end), '-q:v', '3', os.path.join(frames, '%05d.jpg')]
    subprocess.run(cmd, check=True)
    count = len(glob.glob(os.path.join(frames, '*.jpg')))
    return {'dir': 'frames', 'count': count, 'fps': fps, 'w': w, 'h': h, 'duration': round(count / fps, 3)}


def make_voice(cfg, args, total, intro, out_wav):
    import numpy as np
    import soundfile as sf
    from kokoro_onnx import Kokoro

    voices = args.voices
    if not voices.endswith('.npz'):
        data = {
            f[:-4]: np.fromfile(os.path.join(voices, f), dtype=np.float32).reshape(-1, 1, 256)
            for f in os.listdir(voices)
            if f.endswith('.bin')
        }
        voices = os.path.join(os.path.dirname(out_wav), 'voices.npz')
        np.savez(voices, **data)
    tts = Kokoro(args.model, voices)
    sr = 24000
    track = np.zeros(int((total + 1) * sr), np.float32)
    for s in cfg.get('segments', []):
        text = s.get('say', s.get('caption'))
        if not text or s.get('say') is False:
            continue
        audio, got = tts.create(text, voice=args.voice, speed=s.get('speed', 1.0), lang='en-us')
        assert got == sr
        t0 = intro + s['from'] + 0.35
        dur = len(audio) / sr
        room = s['to'] - s['from'] - 0.35
        warn = f'  <-- {dur - room:.1f}s too long: shorten it or widen the segment' if dur > room + 0.1 else ''
        print(f'  voice {t0:6.2f}s {dur:4.1f}s  {text}{warn}')
        j = int(t0 * sr)
        track[j : j + len(audio)] += audio[: len(track) - j]
    sf.write(out_wav, track, sr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('config')
    ap.add_argument('--out')
    ap.add_argument('--size', default=None, help='WIDTHxHEIGHT, default from "format": 1920x1080 or 1080x1920')
    ap.add_argument('--fps', type=int, default=30)
    ap.add_argument('--model')
    ap.add_argument('--voices')
    ap.add_argument('--voice', default='af_heart')
    ap.add_argument('--stills')
    ap.add_argument('--fonts', help='folder with bricolage-grotesque-latin-wght-normal.woff2 and hanken-grotesk-latin-wght-normal.woff2')
    args = ap.parse_args()

    cfg_path = os.path.abspath(args.config)
    base = os.path.dirname(cfg_path)
    cfg = json.load(open(cfg_path))
    name = os.path.splitext(os.path.basename(cfg_path))[0]
    work = os.path.join(base, f'.{name}-build')
    os.makedirs(work, exist_ok=True)
    size = args.size or ('1080x1920' if cfg.get('format') == 'vertical' else '1920x1080')
    width, height = size.split('x')

    print('1/5 frames')
    cfg['clip'] = prepare_frames(cfg, base, work, args.fps)
    # Segment times are seconds of the original recording (as in timeline.json);
    # shift them to the trimmed clip.
    shift = float(cfg.get('clipStart', 0))
    for s in cfg.get('segments', []):
        s['from'], s['to'] = round(s['from'] - shift, 3), round(s['to'] - shift, 3)
    intro, outro = cfg.get('intro', 2.4), cfg.get('outro', 3)
    total = round(intro + cfg['clip']['duration'] + outro, 2)
    for s in cfg.get('segments', []):
        if s['to'] > cfg['clip']['duration'] + 0.01:
            print(f"  warning: segment '{s.get('caption')}' ends after the clip ({cfg['clip']['duration']}s)")

    print('2/5 page')
    shutil.copy(os.path.join(SKILL, 'assets', 'walkthrough.html'), os.path.join(work, 'index.html'))
    with open(os.path.join(work, 'config.js'), 'w') as f:
        f.write('window.WT = ' + json.dumps(cfg, ensure_ascii=False) + ';\n')
    fonts_src = args.fonts or os.path.join(base, 'fonts')
    if os.path.isdir(fonts_src):
        shutil.copytree(fonts_src, os.path.join(work, 'fonts'), dirs_exist_ok=True)
    else:
        print('  warning: no fonts folder; the video will use fallback fonts (see SKILL.md setup)')

    voice = None
    if args.model and args.voices:
        print('3/5 voice')
        voice = os.path.join(work, 'voice.wav')
        make_voice(cfg, args, total, intro, voice)
    else:
        print('3/5 voice skipped (silent video)')

    if args.stills:
        subprocess.run(['node', RENDER, os.path.join(work, 'index.html'), '--stills', args.stills, '--width', width, '--height', height], check=True)
        for p in glob.glob(os.path.join(work, 'still-*.png')):
            shutil.move(p, os.path.join(base, f'{name}-' + os.path.basename(p)))

    print(f'4/5 render {total}s at {size}')
    silent = os.path.join(work, 'video.mp4')
    subprocess.run(
        ['node', RENDER, os.path.join(work, 'index.html'), silent, '--duration', str(total), '--fps', str(args.fps), '--width', width, '--height', height],
        check=True,
    )

    print('5/5 mux')
    out = os.path.abspath(args.out or os.path.join(base, f'{name}.mp4'))
    if voice:
        cmd = [ffmpeg(), '-loglevel', 'error', '-y', '-i', silent, '-i', voice, '-map', '0:v', '-map', '1:a', '-c:v', 'copy']
        cmd += ['-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out]
    else:
        cmd = [ffmpeg(), '-loglevel', 'error', '-y', '-i', silent, '-c:v', 'copy', '-an', '-movflags', '+faststart', out]
    subprocess.run(cmd, check=True)
    print(f'Done: {out}')


if __name__ == '__main__':
    main()
