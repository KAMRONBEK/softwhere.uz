"""Speak short voice lines on the beat grid of a hype reel (no visual stretching).

Lines file (JSON): [{"bar": 1, "beat": 0, "text": "Got an app idea?", "speed": 1.12}, ...]
Each line starts at T(bar, beat) + 30 ms. A warning is printed when a line runs into the next
one: shorten the words or raise its speed. Then mix: python3 music.py music.wav --voice voice.wav

Usage: python3 beat_voice.py lines.json voice.wav --model kokoro-q8.onnx --voices <kokoro-js>/voices [--voice af_heart] [--bpm 128] [--length 30]
"""

import argparse
import json
import os

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('lines')
    ap.add_argument('out')
    ap.add_argument('--model', required=True)
    ap.add_argument('--voices', required=True, help='kokoro-js voices folder or a voices .npz')
    ap.add_argument('--voice', default='af_heart')
    ap.add_argument('--bpm', type=float, default=128)
    ap.add_argument('--length', type=float, default=30)
    a = ap.parse_args()

    voices = a.voices
    if not voices.endswith('.npz'):
        data = {f[:-4]: np.fromfile(os.path.join(voices, f), dtype=np.float32).reshape(-1, 1, 256) for f in os.listdir(voices) if f.endswith('.bin')}
        voices = os.path.join(os.path.dirname(os.path.abspath(a.out)), 'voices.npz')
        np.savez(voices, **data)
    tts = Kokoro(a.model, voices)

    beat = 60 / a.bpm
    at = lambda l: (l['bar'] - 1) * 4 * beat + l.get('beat', 0) * beat + 0.03
    lines = sorted(json.load(open(a.lines)), key=at)
    sr = 24000
    track = np.zeros(int(a.length * sr), np.float32)
    for i, line in enumerate(lines):
        audio, got = tts.create(line['text'], voice=a.voice, speed=line.get('speed', 1.12), lang='en-us')
        assert got == sr
        t0, dur = at(line), len(audio) / sr
        nxt = at(lines[i + 1]) if i + 1 < len(lines) else a.length
        warn = '  <-- runs into the next line' if t0 + dur > nxt + 0.05 else ''
        print(f"{t0:6.2f}s {dur:4.2f}s  {line['text']}{warn}")
        j = int(t0 * sr)
        track[j : j + len(audio)] += audio[: len(track) - j]
    sf.write(a.out, track, sr)


if __name__ == '__main__':
    main()
