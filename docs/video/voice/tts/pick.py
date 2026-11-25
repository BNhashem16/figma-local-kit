"""Pick the clearest TTS take per line: transcribe every candidate with Whisper and keep the lowest character error rate.

Usage: uvx --from mlx-whisper python pick.py picks.json
picks.json: {"jobs": [{"text": "...", "cands": ["a.c0.wav", ...], "out": "a.wav"}]}
"""
import json
import re
import shutil
import sys

import mlx_whisper

MODEL = "mlx-community/whisper-large-v3-turbo"


def norm(s: str) -> str:
    s = re.sub(r"[ً-ْـ]", "", s)  # tashkeel + tatweel
    s = re.sub(r"[إأآا]", "ا", s).replace("ة", "ه").replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    return re.sub(r"[^ء-ي]", "", s)


def cer(ref: str, hyp: str) -> float:
    r, h = norm(ref), norm(hyp)
    d = list(range(len(h) + 1))
    for i, rc in enumerate(r, 1):
        prev, d[0] = d[0], i
        for j, hc in enumerate(h, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (rc != hc))
    return d[len(h)] / max(1, len(r))


def main() -> None:
    cfg = json.load(open(sys.argv[1], encoding="utf-8"))
    for job in cfg["jobs"]:
        scored = []
        for c in job["cands"]:
            hyp = mlx_whisper.transcribe(c, path_or_hf_repo=MODEL, language="ar")["text"].strip()
            scored.append((cer(job["text"], hyp), c, hyp))
        best = min(scored)
        if best[1] != job["out"]:
            shutil.copyfile(best[1], job["out"])
        print(f"{best[0]:.2f}  {job['text']}  =>  {best[2]}", flush=True)


if __name__ == "__main__":
    main()
