"""AI voice-over for the Lumen demo video: one MP3 per line of vo.json, plus word timings for synced captions.
Voice: Microsoft Edge neural voice "Andrew" (edge-tts). Output: $LUMEN_VIDEO/vo/<id>.mp3 and $LUMEN_VIDEO/vo/voice.json
    python tools/video/make_voice.py
"""
import asyncio, json, os, subprocess, sys
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.environ.get("LUMEN_VIDEO", os.path.join(os.environ.get("TEMP", "/tmp"), "lumen-video")), "vo")
FFPROBE = os.environ.get("FFPROBE", "ffprobe")
VOICE, RATE, PITCH = "en-US-AndrewNeural", "-6%", "-2Hz"
os.makedirs(OUT, exist_ok=True)


async def synth(text, path):
    c = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH, boundary="WordBoundary")
    words = []
    with open(path, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append([round(ch["offset"] / 1e7, 3), round((ch["offset"] + ch["duration"]) / 1e7, 3), ch["text"]])
    return words


def duration(p):
    return float(subprocess.check_output([FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).decode().strip())


async def main():
    lines = json.load(open(os.path.join(HERE, "vo.json"), encoding="utf-8"))
    out = {}
    for key, text in lines:
        p = os.path.join(OUT, key + ".mp3")
        for attempt in range(5):
            try:
                words = await asyncio.wait_for(synth(text, p), 60)
                break
            except Exception as e:  # the service is occasionally flaky
                print("retry", key, repr(e), file=sys.stderr)
        out[key] = {"text": text, "duration": round(duration(p), 3), "words": words}
        print(key, out[key]["duration"])
    json.dump(out, open(os.path.join(OUT, "voice.json"), "w", encoding="utf-8"), indent=1)
    print("total", round(sum(v["duration"] for v in out.values()), 2))


asyncio.run(main())
