#!/usr/bin/env bash
# Record a scripted walkthrough of a mobile app running in the iOS Simulator or an
# Android emulator / phone, driven by a Maestro flow.
#
# Usage: record-mobile.sh ios|android <flow.yaml> <out-dir>
#
# Needs: Maestro (https://maestro.dev, `curl -Ls "https://get.maestro.mobile.dev" | bash`),
#        Xcode for iOS (a booted simulator with the app installed),
#        adb for Android (one emulator or phone connected, app installed).
# Writes <out-dir>/clip.mp4 and Maestro's screenshots (takeScreenshot steps) into <out-dir>.
# Android's screenrecord stops by itself at 180 seconds, so keep each flow under 3 minutes.
set -euo pipefail

platform="${1:?ios or android}"
flow="$(cd "$(dirname "${2:?flow.yaml}")" && pwd)/$(basename "$2")"
out="${3:?out dir}"
mkdir -p "$out"
out="$(cd "$out" && pwd)"

if [[ "$platform" == "ios" ]]; then
  # Clean status bar: 9:41, full battery and signal.
  xcrun simctl status_bar booted override --time "9:41" --batteryState charged --batteryLevel 100 \
    --cellularMode active --cellularBars 4 --wifiBars 3 || true
  xcrun simctl io booted recordVideo --codec h264 --force "$out/clip.mov" &
  rec=$!
  sleep 2
  (cd "$out" && maestro test "$flow") || echo "Maestro flow failed; keeping what was recorded."
  sleep 1
  kill -INT "$rec"
  wait "$rec" || true
  xcrun simctl status_bar booted clear || true
  ffmpeg="${FFMPEG:-$(python3 -c 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())')}"
  "$ffmpeg" -loglevel error -y -i "$out/clip.mov" -c:v libx264 -crf 18 -pix_fmt yuv420p -an "$out/clip.mp4"
  rm -f "$out/clip.mov"
elif [[ "$platform" == "android" ]]; then
  # Demo mode: clean status bar (12:00, full battery, no notifications).
  adb shell settings put global sysui_demo_allowed 1
  adb shell am broadcast -a com.android.systemui.demo -e command enter >/dev/null
  adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 1200 >/dev/null
  adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false >/dev/null
  adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false >/dev/null
  adb shell screenrecord --bit-rate 8000000 /sdcard/softwhere-clip.mp4 &
  rec=$!
  sleep 2
  (cd "$out" && maestro test "$flow") || echo "Maestro flow failed; keeping what was recorded."
  sleep 1
  adb shell pkill -INT screenrecord || true
  wait "$rec" || true
  sleep 2
  adb pull /sdcard/softwhere-clip.mp4 "$out/clip.mp4" >/dev/null
  adb shell rm /sdcard/softwhere-clip.mp4
  adb shell am broadcast -a com.android.systemui.demo -e command exit >/dev/null
else
  echo "First argument must be ios or android" >&2
  exit 1
fi

echo "Saved $out/clip.mp4"
