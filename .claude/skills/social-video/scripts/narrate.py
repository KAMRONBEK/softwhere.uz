"""Add an AI narrator to a social-video reel.

Reads a scenes file (see ../assets/launch-reel-narration.json), speaks each scene's
lines with Kokoro-82M (Apache-2.0, runs locally on CPU), and writes next to it:
  narration.wav  the voice track, placed scene by scene
  timing.js      window.TIMING: maps real time to the reel's design timeline, so the
                 visuals hold while a line is spoken and reveals land on sentences

Usage:
  python3 narrate.py <scenes.json> --model kokoro-q8.onnx --voices <kokoro-js>/voices [--voice af_heart] [--speed 1.0]

Setup: pip install kokoro-onnx soundfile; voices come with the npm package kokoro-js,
the ONNX model from Hugging Face (onnx-community/Kokoro-82M-v1.0-ONNX) or, where
Hugging Face is blocked, the npm package kokoro-q8-shards (concatenate its parts).
"""

import argparse
import json
import os

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

SR = 24000
GAP = 0.22  # pause between sentences inside a scene, in seconds


def load_voices(path):
    if path.endswith('.npz'):
        return path
    voices = {f[:-4]: np.fromfile(os.path.join(path, f), dtype=np.float32).reshape(-1, 1, 256) for f in os.listdir(path) if f.endswith('.bin')}
    out = os.path.join(os.path.dirname(os.path.abspath(path)), 'voices.npz')
    np.savez(out, **voices)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('scenes')
    ap.add_argument('--model', required=True)
    ap.add_argument('--voices', required=True, help='kokoro-js voices folder or a voices .npz')
    ap.add_argument('--voice', default=None)
    ap.add_argument('--speed', type=float, default=None)
    args = ap.parse_args()

    spec = json.load(open(args.scenes))
    voice = args.voice or spec.get('voice', 'af_heart')
    speed = args.speed or spec.get('speed', 1.0)
    eps = 1 / spec.get('fps', 30)
    tts = Kokoro(args.model, load_voices(args.voices))

    keys, clips, t = [], [], 0.0
    for s in spec['scenes']:
        design = s['B'] - s['A']
        parts, starts, pos = [], [], 0.0
        for i, text in enumerate(s['say']):
            audio, sr = tts.create(text, voice=voice, speed=speed, lang='en-us')
            assert sr == SR
            if i:
                parts.append(np.zeros(int(GAP * SR), np.float32))
                pos += GAP
            starts.append(pos)
            parts.append(audio.astype(np.float32))
            pos += len(audio) / SR
        real = max(design, s['lead'] + pos + s['tail'])
        if parts:
            clips.append((t + s['lead'], np.concatenate(parts)))
        if 'align' in s:  # reveal item i as sentence i starts, then hold
            keys.append((t, s['A']))
            for st, d in zip(starts, s['align']):
                keys += [(t + s['lead'] + st - 0.12, d), (t + s['lead'] + st + 0.48, d + 0.6)]
            keys.append((t + real - eps, s['B'] - eps))
        else:  # play the scene at normal speed, then hold its last frame
            keys += [(t, s['A']), (t + design - eps, s['B'] - eps), (t + real - eps, s['B'] - eps)]
        print(f"scene {s['A']:5.1f}-{s['B']:5.1f}: {real:5.2f}s real, {pos:4.2f}s spoken")
        t += real

    total = round(t + 0.2, 2)
    track = np.zeros(int(total * SR), np.float32)
    for start, audio in clips:
        i = int(start * SR)
        track[i : i + len(audio)] += audio
    folder = os.path.dirname(os.path.abspath(args.scenes))
    sf.write(os.path.join(folder, 'narration.wav'), track, SR)
    keys.append((total, spec.get('designEnd', spec['scenes'][-1]['B'])))
    timing = {'total': total, 'keys': [[round(a, 4), round(b, 4)] for a, b in keys]}
    with open(os.path.join(folder, 'timing.js'), 'w') as f:
        f.write('window.TIMING = ' + json.dumps(timing) + ';\n')
    print(f'total {total}s -> narration.wav, timing.js')


if __name__ == '__main__':
    main()
