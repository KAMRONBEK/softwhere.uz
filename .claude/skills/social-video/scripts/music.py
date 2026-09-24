"""Original uplifting house track + sound effects for the SoftWhere reel.

Everything is synthesised here from oscillators and noise, so the track is ours:
no samples, no licences, no copyright claims. 128 BPM, C major (Am-F-C-G),
16 bars = exactly 30 s, arranged to loop seamlessly on Instagram.

Usage: python3 music.py out.wav [--voice narration.wav]   (voice ducks the music)
"""
import argparse
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, sosfilt_zi, fftconvolve

SR = 44100
BPM = 128
BEAT = 60 / BPM            # 0.46875 s
BAR = 4 * BEAT             # 1.875 s
BARS = 16
DUR = BARS * BAR           # 30.0 s
N = int(round(DUR * SR))
TAIL = int(2.5 * SR)       # render tails past the end, then wrap them to the start (seamless loop)
rng = np.random.default_rng(128)


def T(bar, beat=0.0):
    """Time in seconds of a bar (1-based) and beat (0-based, may be fractional)."""
    return (bar - 1) * BAR + beat * BEAT


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def buf():
    return np.zeros((N + TAIL, 2), np.float32)


def place(dst, x, t, gain=1.0, pan=0.0):
    """Add mono (n,) or stereo (n,2) x into dst at time t with equal-power pan."""
    i = int(round(t * SR))
    if i >= len(dst):
        return
    x = np.asarray(x, np.float32)
    if x.ndim == 1:
        a = (pan + 1) * np.pi / 4
        x = np.stack([x * np.cos(a), x * np.sin(a)], 1)
    if i < 0:
        x, i = x[-i:], 0
    n = min(len(x), len(dst) - i)
    dst[i:i + n] += gain * x[:n]


def sos_filter(x, kind, fc, order=2):
    fc = np.clip(fc, 20, SR / 2 - 200)
    return sosfilt(butter(order, fc / (SR / 2), kind, output='sos'), x)


def sweep_filter(x, kind, fc_curve, block=256):
    """Time-varying Butterworth filter (fc_curve: per-sample cutoff)."""
    y = np.zeros_like(x)
    zi = None
    for s in range(0, len(x), block):
        fc = float(np.clip(fc_curve[min(s, len(fc_curve) - 1)], 30, SR / 2 - 500))
        sos = butter(2, fc / (SR / 2), kind, output='sos')
        if zi is None:
            zi = sosfilt_zi(sos) * 0
        y[s:s + block], zi = sosfilt(sos, x[s:s + block], zi=zi)
    return y


def saw(freq, n, phase=None):
    """Band-limited (polyBLEP) sawtooth; freq may be a scalar or per-sample array."""
    f = np.broadcast_to(np.asarray(freq, np.float64), (n,))
    dt = f / SR
    ph = ((rng.random() if phase is None else phase) + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m = ph < dt
    x = ph[m] / dt[m]
    y[m] -= x + x - x * x - 1
    m = ph > 1 - dt
    x = (ph[m] - 1) / dt[m]
    y[m] -= x * x + x + x + 1
    return y


def env(n, a=0.005, d=0.1, s=0.7, r=0.05, hold=None):
    """ADSR over n samples; release starts at `hold` seconds (default: n - r)."""
    t = np.arange(n) / SR
    hold = (n / SR - r) if hold is None else hold
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = t > hold
    e[rel] *= np.exp(-(t[rel] - hold) / max(r / 4, 1e-4))
    return e


# ---------------------------------------------------------------- drums
def kick():
    n = int(0.5 * SR); t = np.arange(n) / SR
    f = 46 + 120 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 6.5) + 0.3 * np.sin(2 * ph) * np.exp(-t * 14)
    click = sos_filter(rng.standard_normal(n), 'highpass', 1800) * np.exp(-t * 300) * 0.5
    return np.tanh(1.8 * (body + click)) * 0.95


def clap():
    n = int(0.4 * SR); t = np.arange(n) / SR
    noise = sos_filter(sos_filter(rng.standard_normal(n), 'highpass', 900), 'lowpass', 5200)
    e = np.zeros(n)
    for t0 in (0.0, 0.009, 0.019, 0.028):
        e += np.where(t >= t0, np.exp(-(t - t0) * 190), 0)
    e += np.exp(-t * 16) * 0.35 * (t > 0.028)
    return noise * e * 0.55


def hat(open_=False):
    n = int((0.28 if open_ else 0.07) * SR); t = np.arange(n) / SR
    x = sos_filter(rng.standard_normal(n), 'highpass', 7500)
    metal = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (5400, 6800, 8200)) * 0.15
    return (x + metal) * np.exp(-t * (13 if open_ else 85))


def snare(pitch=1.0):
    n = int(0.22 * SR); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 190 * pitch * t) * np.exp(-t * 30)
    noise = sos_filter(rng.standard_normal(n), 'bandpass', [1200 * pitch, 7000]) * np.exp(-t * 22)
    return (0.5 * body + 0.8 * noise)


def crash():
    n = int(2.4 * SR); t = np.arange(n) / SR
    x = sos_filter(rng.standard_normal((n, 2)).T, 'highpass', 4500).T
    return x * np.exp(-t * 1.9)[:, None] * 0.5


# ---------------------------------------------------------------- tonal
def supersaw(midi, dur, voices=7, detune=0.22, fc=4000, fenv=0.0, fdecay=8.0, a=0.004, d=0.25, s=0.6, r=0.12):
    n = int((dur + r * 2) * SR); t = np.arange(n) / SR
    L = np.zeros(n); R = np.zeros(n)
    for v in range(voices):
        off = (v - (voices - 1) / 2) / ((voices - 1) / 2) if voices > 1 else 0
        f = hz(midi) * 2 ** (off * detune / 12)
        w = saw(f, n)
        pan = off * 0.8
        L += w * np.cos((pan + 1) * np.pi / 4); R += w * np.sin((pan + 1) * np.pi / 4)
    L /= voices ** 0.5; R /= voices ** 0.5
    curve = fc + fenv * np.exp(-t * fdecay)
    L = sweep_filter(L, 'lowpass', curve); R = sweep_filter(R, 'lowpass', curve)
    e = env(n, a, d, s, r, hold=dur)
    return np.stack([L * e, R * e], 1)


def bass(midi, dur):
    n = int((dur + 0.06) * SR); t = np.arange(n) / SR
    f = hz(midi)
    x = 0.8 * saw(f, n) + 0.3 * np.sin(2 * np.pi * f / 2 * t) + 0.3 * saw(f * 2 ** (0.08 / 12), n)
    x = sweep_filter(x, 'lowpass', 650 + 1900 * np.exp(-t * 14))
    return np.tanh(1.4 * x) * env(n, 0.003, 0.08, 0.8, 0.04, hold=dur)


def pluck(midi, dur=0.2):
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = hz(midi)
    x = 0.6 * saw(f, n) + 0.4 * (2 * np.abs(2 * ((f * t) % 1) - 1) - 1)
    x = sweep_filter(x, 'lowpass', 900 + 5500 * np.exp(-t * 22))
    return x * np.exp(-t * 11)


# ---------------------------------------------------------------- effects
def whoosh(dur=0.55, lo=250, hi=3800, pan_from=-0.8, pan_to=0.8):
    n = int(dur * SR); u = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    centre = lo * (hi / lo) ** np.sin(np.pi * u)
    x = sweep_filter(noise, 'lowpass', centre * 1.6) - sweep_filter(noise, 'lowpass', centre * 0.6)
    amp = np.sin(np.pi * u) ** 2
    L = np.zeros(n); R = np.zeros(n)
    pan = pan_from + (pan_to - pan_from) * u
    L = x * amp * np.cos((pan + 1) * np.pi / 4); R = x * amp * np.sin((pan + 1) * np.pi / 4)
    return np.stack([L, R], 1)


def whip():
    return whoosh(0.22, 1200, 7000, 0.6, -0.6) * 1.3


def impact(size=1.0):
    n = int(2.2 * SR); t = np.arange(n) / SR
    f = 30 + 55 * np.exp(-t * 5)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.4)
    hit = sos_filter(rng.standard_normal(n), 'lowpass', 2200) * np.exp(-t * 18)
    return np.tanh(2 * (sub * 0.9 + hit * 0.6 * size)) * size


def riser(dur, lo=300, hi=9000):
    n = int(dur * SR); u = np.linspace(0, 1, n)
    noise = sweep_filter(rng.standard_normal(n), 'highpass', lo * (hi / lo) ** u)
    tone = saw(180 * 2 ** (u * 3), n) * 0.25
    tone = sweep_filter(tone, 'lowpass', 600 + 5000 * u)
    return (noise * 0.7 + tone) * u ** 2.2


def ding():
    n = int(1.4 * SR); t = np.arange(n) / SR
    x = sum(a * np.sin(2 * np.pi * hz(91) * k * t) * np.exp(-t * (3 + 2 * k)) for k, a in ((1, 1), (2, 0.35), (3, 0.18), (4.2, 0.08)))
    return x * 0.5


def click():
    n = int(0.03 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 2300 * t) + sos_filter(rng.standard_normal(n), 'highpass', 3000) * 0.5) * np.exp(-t * 260)


def sparkle(dur=0.9):
    n = int(dur * SR); out = np.zeros((n, 2))
    for i in range(14):
        t0 = rng.random() * dur * 0.6; m = rng.choice([96, 98, 100, 103, 105, 108])
        k = int(0.25 * SR); tt = np.arange(k) / SR
        x = np.sin(2 * np.pi * hz(m) * tt) * np.exp(-tt * 18) * 0.12
        i0 = int(t0 * SR); pan = rng.uniform(-0.9, 0.9)
        seg = out[i0:i0 + k]
        seg[:, 0] += x[:len(seg)] * np.cos((pan + 1) * np.pi / 4); seg[:, 1] += x[:len(seg)] * np.sin((pan + 1) * np.pi / 4)
    return out


def reverb_ir(seconds=1.9, damp=6500):
    n = int(seconds * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t * 3.3)[:, None]
    ir = sos_filter(ir.T, 'lowpass', damp).T
    ir[: int(0.012 * SR)] = 0
    return ir / np.abs(ir).sum(0).max() * 6


# ---------------------------------------------------------------- arrangement
CHORDS = [  # Am F C G (vi-IV-I-V)
    dict(root=45, pad=[57, 60, 64, 69], tones=[69, 72, 76, 81]),
    dict(root=41, pad=[57, 60, 65, 69], tones=[69, 72, 77, 81]),
    dict(root=48, pad=[55, 60, 64, 67], tones=[67, 72, 76, 79]),
    dict(root=43, pad=[55, 59, 62, 67], tones=[67, 71, 74, 79]),
]
LEAD = [  # (beat, midi, length in beats) per bar of the 4-bar hook
    [(0, 76, .5), (.5, 76, .5), (1, 79, .5), (1.5, 76, .5), (2, 81, .75), (3, 79, .5), (3.5, 76, .5)],
    [(0, 84, .5), (.5, 81, .5), (1, 79, .5), (1.5, 81, .5), (2, 84, .75), (3, 81, .5), (3.5, 79, .5)],
    [(0, 79, .5), (.5, 76, .5), (1, 79, .5), (1.5, 84, .5), (2, 88, .75), (3, 86, .5), (3.5, 84, .5)],
    [(0, 86, .5), (.5, 83, .5), (1, 79, .5), (1.5, 83, .5), (2, 86, 1.0), (3.5, 83, .5)],
]
DROP = T(9)
KICKS = [T(b, k) for b in range(1, 17) for k in range(4) if not (b == 8 and k >= 2)]


def sidechain(depth):
    g = np.ones(N + TAIL)
    shape = 1 - depth * np.exp(-np.arange(int(0.35 * SR)) / SR / 0.075)
    for tk in KICKS:
        i = int(tk * SR); seg = g[i:i + len(shape)]
        np.minimum(seg, shape[:len(seg)], out=seg)
    return g[:, None]


def build(voice_path=None):
    drums, music, fx, rev_send = buf(), buf(), buf(), buf()
    K, C = kick(), clap()
    for tk in KICKS:
        place(drums, K, tk, 0.62)
    for b in range(1, 17):
        if b == 8:
            continue
        for k in (1, 3):
            place(drums, C, T(b, k), 0.62, 0.05); place(rev_send, C, T(b, k), 0.18)
    for b in range(1, 17):  # hats
        if b <= 8 or b >= 15:
            for k in range(4):
                place(drums, hat(), T(b, k + .5), 0.24, 0.3)
        if 9 <= b <= 14:
            for s in range(16):
                acc = 0.22 if s % 4 == 2 else 0.1
                place(drums, hat(), T(b, s / 4), acc, 0.3)
            for k in range(4):
                place(drums, hat(True), T(b, k + .5), 0.13, -0.3)
    # snare roll into the drop: bar 7 eighths, bar 8 sixteenths, rising
    roll = [(T(7, k / 2), k / 8) for k in range(8)] + [(T(8, s / 4), 1 + s / 14) for s in range(14)]
    for i, (t0, p) in enumerate(roll):
        v = 0.12 + 0.3 * i / len(roll)
        place(drums, snare(0.9 + 0.25 * p), t0, v); place(rev_send, snare(1), t0, v * 0.4)
    for t0 in (T(3), DROP, T(13), T(15)):
        place(drums, crash(), t0, 0.32)

    # chords: pumping supersaw pads, filter opening over the intro
    pad_bus = buf()
    for b in range(1, 17):
        ch = CHORDS[(b - 1) % 4]
        fc = {1: 1700, 2: 2900}.get(b, 7000 if 9 <= b <= 14 else 3600)
        for m in ch['pad']:
            place(pad_bus, supersaw(m, BAR * 0.98, voices=5, detune=0.18, fc=fc, a=0.01, d=0.6, s=0.75, r=0.15), T(b), 0.13)
    pad_bus *= sidechain(0.72)
    music += pad_bus; rev_send += pad_bus * 0.35

    bass_bus = buf()
    for b in range(3, 17):
        if b == 8:
            continue
        root = CHORDS[(b - 1) % 4]['root']
        if 9 <= b <= 14:
            for s in range(8):
                place(bass_bus, bass(root + (12 if s % 2 else 0), BEAT * 0.45), T(b, s / 2), 0.34)
        else:
            for k in range(4):
                place(bass_bus, bass(root, BEAT * 0.42), T(b, k + .5), 0.36)
    bass_bus *= sidechain(0.5)
    music += bass_bus

    arp_bus = buf()
    for b in list(range(5, 9)) + list(range(9, 15)):
        tones = CHORDS[(b - 1) % 4]['tones']
        for s in range(16):
            if b == 8 and s >= 12:
                break
            place(arp_bus, pluck(tones[s % 4] + (12 if s % 8 >= 4 else 0)), T(b, s / 4), 0.1 if b < 9 else 0.07, 0.35 if s % 2 else -0.35)
    music += arp_bus; rev_send += arp_bus * 0.5

    lead_bus = buf()
    for b in range(9, 17):
        for beat, m, ln in LEAD[(b - 9) % 4]:
            g = 0.3 if b <= 14 else 0.2
            place(lead_bus, supersaw(m, ln * BEAT, voices=7, detune=0.28, fc=1800, fenv=6500, fdecay=7, a=0.003, d=0.18, s=0.55, r=0.1), T(b, beat), g)
            place(lead_bus, supersaw(m + 12, ln * BEAT, voices=3, detune=0.12, fc=2500, fenv=4000, a=0.003, d=0.12, s=0.3, r=0.08), T(b, beat), g * 0.35)
    lead_bus *= sidechain(0.35)
    delay = np.zeros_like(lead_bus); dly = int(0.75 * BEAT * SR)
    for i in range(1, 5):
        delay[dly * i:] += lead_bus[:-dly * i] * (0.32 ** i) * (1 if i % 2 else 0.8)
    delay[:, [0, 1]] = delay[:, [1, 0]]  # ping-pong feel
    music += lead_bus + delay * 0.6; rev_send += lead_bus * 0.4

    # effects on the cuts
    place(fx, riser(BAR), T(2), 0.18)
    place(fx, riser(2 * BAR - 0.25), T(7), 0.42)
    place(fx, riser(BAR), T(16), 0.14)
    rc = crash()[::-1][-int(BEAT * 1.6 * SR):]
    place(fx, rc, DROP - BEAT * 1.6 - 0.25, 0.35)
    for t0, g in ((T(3), 0.45), (DROP, 1.0), (T(15), 0.7)):
        place(fx, impact(g), t0, 0.75 * g); place(rev_send, impact(g), t0, 0.25 * g)
    for t0 in (T(3) - 0.28, T(5) - 0.28, T(11) - 0.28, T(10) - 0.2, T(15) - 0.3):
        place(fx, whoosh(), t0, 0.32)
    for t0 in (T(7) - 0.1, T(13) - 0.1, T(13, 2) - 0.1, T(14) - 0.1, T(14, 2) - 0.1, T(4, 3) - 0.1, T(10, 2) - 0.1, T(2) - 0.1):
        place(fx, whip(), t0, 0.28)
    for k in range(4):  # word slams in the hook
        place(fx, whip() * 0.5, T(1, k) - 0.02, 0.18)
    place(fx, click(), T(5, 1), 0.3)
    for s in range(8):
        place(fx, click(), T(5, 2 + s / 4), 0.08)
    place(fx, sparkle(), T(6), 0.9); place(fx, ding(), T(6), 0.28); place(rev_send, ding(), T(6), 0.15)
    for s in range(48):  # code-typing ticks through the build
        place(fx, click(), T(7, s / 12), 0.05 + 0.05 * rng.random(), rng.uniform(-0.5, 0.5))
    place(fx, ding(), T(15, 0.5), 0.2)

    # drop pause: everything but the reverse cymbal goes silent for the last quarter-second
    gap = slice(int((DROP - 0.24) * SR), int(DROP * SR))
    for bus in (drums, music, rev_send):
        bus[gap] *= 0.0

    wet = np.stack([fftconvolve(rev_send[:, c], reverb_ir()[:, c])[:N + TAIL] for c in range(2)], 1)
    mix = drums + music + fx + wet * 0.55

    if voice_path:
        v, vsr = sf.read(voice_path, dtype='float32')
        if v.ndim > 1:
            v = v.mean(1)
        if vsr != SR:
            v = np.interp(np.arange(int(len(v) * SR / vsr)) * vsr / SR, np.arange(len(v)), v)
        v = np.pad(v, (0, max(0, N + TAIL - len(v))))[:N + TAIL]
        envv = np.convolve(np.abs(v), np.ones(int(0.12 * SR)) / int(0.12 * SR), 'same')
        duck = 1 - 0.6 * np.clip(envv / (envv.max() * 0.25 + 1e-9), 0, 1)
        mix = mix * duck[:, None] + np.stack([v, v], 1) * 1.1

    # seamless loop: wrap everything past 30 s back onto the start
    out = mix[:N].copy()
    out[:TAIL] += mix[N:N + TAIL]
    out = sos_filter(out.T, 'highpass', 28).T
    out = out + 0.45 * sos_filter(out.T, 'bandpass', [1400, 6500]).T  # presence for phone speakers
    out = out / np.abs(out).max() * 0.98
    out = np.tanh(1.6 * out) / np.tanh(1.6)
    return out.astype(np.float32)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--voice')
    a = ap.parse_args()
    x = build(a.voice)
    sf.write(a.out, x, SR)
    sec = lambda b0, b1: x[int(T(b0) * SR):int(T(b1) * SR)]
    for name, b0, b1 in (('hook', 1, 3), ('groove', 3, 7), ('build', 7, 9), ('drop', 9, 15), ('end', 15, 17)):
        s = sec(b0, b1)
        print(f'{name:7s} rms {20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-9):6.1f} dBFS')
    print('length', len(x) / SR, 's  peak', float(np.abs(x).max()))
