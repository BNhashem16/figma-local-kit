"""Builds the video guides with an Egyptian voice-over from ElevenLabs.

    ELEVENLABS_API_KEY=... python3 docs/video/make_video.py mac
    ELEVENLABS_API_KEY=... python3 docs/video/make_video.py windows

Slides are HTML rendered by Chrome. The voice-over is one continuous take for the whole script
(best of 2 takes by Whisper clarity), cut per scene. Takes are cached in docs/video/build/.
"""
import json, pathlib, subprocess, sys

PLATFORM = sys.argv[1] if len(sys.argv) > 1 else "mac"
assert PLATFORM in ("mac", "windows")
WIN = PLATFORM == "windows"
HERE = pathlib.Path(__file__).resolve().parent
BUILD = HERE / "build" / PLATFORM
BUILD.mkdir(parents=True, exist_ok=True)
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
REPO = "github.com/BNhashem16/figma-local-kit"
ELEVEN = {"voiceId": "1hEuyycI7VQwusZo3Qbe", "model": "eleven_v4_turbo", "stability": 0.5, "similarity": 0.8, "style": 0, "speed": 1.0}
MOD = "Ctrl" if WIN else "⌘"

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{width:1920px;height:1080px;font-family:-apple-system,"SF Arabic","Geeza Pro",sans-serif;background:linear-gradient(135deg,#1b1033,#2d1b5e 60%,#3c2a7a);color:#fff;direction:rtl;overflow:hidden}
.wrap{padding:90px 120px;height:100%;display:flex;flex-direction:column}
.step{font-size:34px;color:#c9b6ff;margin-bottom:18px}
h1{font-size:76px;line-height:1.25;margin-bottom:40px}
p,li{font-size:42px;line-height:1.6;color:#ece6ff}
ul{list-style:none}
li{margin:16px 0;padding-right:56px;position:relative}
li:before{content:"✓";position:absolute;right:0;color:#7cf3a0;font-weight:700}
.row{display:flex;gap:70px;align-items:center;flex:1}
.card{background:#fff;color:#222;border-radius:22px;padding:34px 40px;box-shadow:0 30px 80px rgba(0,0,0,.35);direction:ltr;font-family:-apple-system,"Segoe UI",sans-serif}
.term{background:#0d0d12;color:#e6e6e6;border-radius:18px;padding:30px 36px;font:28px/1.55 Menlo,Consolas,monospace;direction:ltr;white-space:pre;box-shadow:0 30px 80px rgba(0,0,0,.4)}
.ok{color:#7cf3a0}.st{color:#c9a3ff;font-weight:700}
.path{display:flex;gap:14px;direction:ltr;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.chip{background:#fff;color:#2a1a55;border-radius:14px;padding:16px 26px;font:600 34px -apple-system,sans-serif}
.arrow{font-size:40px;color:#c9b6ff}
.keys{display:flex;gap:16px;direction:ltr;margin-top:34px;flex-wrap:wrap;justify-content:flex-end}
.key{background:#2a1d55;border:2px solid #8e75ff;border-radius:14px;padding:12px 24px;font:600 34px -apple-system,sans-serif}
.bubble{border-radius:22px;padding:22px 30px;font-size:36px;margin:12px 0;max-width:1350px}
.me{background:#8e75ff;align-self:flex-start}
.cl{background:#fff;color:#222;align-self:flex-end;direction:ltr;font-size:30px}
.foot{font-size:32px;color:#b9a8f0;margin-top:auto;direction:ltr;text-align:right}
.big{font-size:58px}
.note{font-size:34px;color:#d8ccff;margin-top:30px}
.os{display:inline-block;background:#7cf3a0;color:#1b1033;border-radius:12px;padding:6px 18px;font-size:30px;font-weight:700;margin-right:16px}
"""
OS_TAG = f"<span class='os'>{'Windows' if WIN else 'Mac'}</span>"

def page(body):
    return f"<!doctype html><html><head><meta charset='utf-8'><style>{CSS}</style></head><body><div class='wrap'>{body}</div></body></html>"

def chips(*items):
    return "<div class='path'>" + "<span class='arrow'>›</span>".join(f"<span class='chip'>{i}</span>" for i in items) + "</div>"

def keys(*items):
    return "<div class='keys'>" + "".join(f"<span class='key'>{k}</span>" for k in items) + "</div>"

PLUGIN_UI = """<div class='card' style='width:560px'><div style='display:flex;align-items:center;gap:14px;font-size:30px'>
<span style='width:22px;height:22px;border-radius:11px;background:#2ecc71;display:inline-block'></span><b>Figma Local Bridge</b></div>
<div style='font-size:28px;margin-top:12px'>Connected ✓  Waiting for Claude.</div><div style='color:#888;font-size:24px;margin-top:8px'>Keep this window open while Claude works.</div></div>"""

MAC_TERM = """<span class='st'>==&gt; 1/5  Copying files</span>
    <span class='ok'>✓ Files are in ~/FigmaLocalKit</span>
<span class='st'>==&gt; 2/5  Checking Node.js</span>
    <span class='ok'>✓ Node.js v22</span>
<span class='st'>==&gt; 3/5  Checking Claude Code</span>
    <span class='ok'>✓ Claude Code is installed</span>
<span class='st'>==&gt; 4/5  Connecting the bridge to Claude</span>
    <span class='ok'>✓ Added to Claude Code</span>
<span class='st'>==&gt; 5/5  Figma plugin</span>
    <span class='ok'>✓ The plugin path is copied</span>

Done ✓"""
WIN_TERM = MAC_TERM.replace("✓ Files are in ~/FigmaLocalKit", "[OK] Files are in C:\\Users\\you\\FigmaLocalKit").replace("✓", "[OK]").replace("Done [OK]", "Done")

# (slide body, voice-over line). Voice lines: Egyptian Arabic, addressed to a man, full tashkeel, numbers as words.
SCENES = [
  (f"<div class='step'>دليل التشغيل {OS_TAG}</div><h1>خلّي Claude يشتغل على ملفات Figma<br>من على جهازك</h1><p>من غير Figma MCP اللي على النت — من غير حد أقصى ومن غير tokens زيادة.</p><div class='foot'>{REPO}</div>",
   "أَهْلاً بِيك.. فِي الفِيدْيو دَه، هَنْشَغَّل Claude عَلَى مِلَفَّات Figma، مِن عَلَى جِهازَك، خُطْوَة بِخُطْوَة، وِمِن غِير أَيّ بَرْمَجَة."),
  (f"<div class='step'>قبل ما تبدأ</div><h1>محتاج 3 حاجات</h1><ul><li>جهاز {'Windows' if WIN else 'Mac'}</li><li>برنامج Figma Desktop بحساب يقدر يعدّل على الملف</li><li>اشتراك Claude (Pro أو Max)</li></ul>",
   f"قَبْل ما نِبْدَأ، إِنْتَ مِحْتاج تَلات حاجات: جِهاز {'Windows' if WIN else 'ماك'}، وبَرْنامِج Figma Desktop، بِحِساب يِقْدَر يِعَدِّل عَلَى المِلَفّ، واشْتِراك فِي Claude."),
  (f"<div class='step'>الخطوة 1</div><h1>نزّل الأداة من GitHub</h1><div class='row'><div class='card' style='font-size:34px'><div style='color:#555'>{REPO}</div><div style='margin-top:24px'><span style='background:#1f883d;color:#fff;border-radius:10px;padding:12px 24px;font-weight:700'>&lt;&gt; Code ▾</span></div><div style='margin-top:22px;border:1px solid #ddd;border-radius:12px;padding:16px 22px'>⬇︎ Download ZIP</div></div><p>دوس <b>Code</b><br>وبعدين <b>Download ZIP</b><br>" + ("وبعدين كليك يمين على الملف<br>← <b>Extract All</b>" if WIN else "وافتح الملف من Downloads") + "</p></div>",
   "أَوِّل خُطْوَة: اِفْتَح صَفْحِةْ الأَداة عَلَى GitHub، وِدُوس عَلَى الزُّرَار الأَخْضَر Code، وبَعْدِين Download ZIP. " +
   ("وبَعْد كِدَه، دُوس كْلِيك يِمِين عَلَى المِلَفّ، واخْتار Extract All." if WIN else "وبَعْد كِدَه، اِفْتَح المِلَفّ مِن الـ Downloads.")),
  ((f"<div class='step'>الخطوة 2</div><h1>شغّل ملف التثبيت</h1><div class='row'><div class='card' style='font-size:32px;width:640px'><div style='color:#0067c0;font-weight:700'>Windows protected your PC</div><div style='margin-top:16px;text-decoration:underline'>More info</div><div style='margin-top:22px;text-align:right'><span style='background:#eee;border-radius:8px;padding:10px 22px'>Run anyway</span></div></div><p>دبل كليك على<br><b>Install-Windows.bat</b><br>لو ظهرت الرسالة الزرقا:<br><b>More info</b> ← <b>Run anyway</b></p></div>")
   if WIN else
   ("<div class='step'>الخطوة 2</div><h1>شغّل ملف التثبيت</h1><div class='row'><div class='card' style='font-size:32px;width:640px'><div>📄 Install-Mac.command</div><div style='margin-top:18px;border-top:1px solid #eee;padding-top:14px'><b>Open</b></div><div style='color:#999'>Get Info</div><div style='color:#999'>Rename</div></div><p>كليك يمين على<br><b>Install-Mac.command</b><br>وبعدين <b>Open</b><br>وبعدين <b>Open</b> تاني</p></div>"),
   ("تانِي خُطْوَة: جُوَّه الفولْدَر، اِعْمِل دَبَل كْلِيك عَلَى Install Windows. ولَوْ ظَهَرِتْلَك رِسالَة زَرْقا مِن Windows، دُوس More info، وبَعْدِين Run anyway."
    if WIN else
    "تانِي خُطْوَة: جُوَّه الفولْدَر، دُوس كْلِيك يِمِين عَلَى Install Mac، واخْتار Open، وبَعْدِين Open تانِي. دَه بِيِحْصَل أَوِّل مَرَّة بَسّ.")),
  (f"<div class='step'>الخطوة 3</div><h1>استنى لحد ما يكتب Done</h1><div class='term'>{WIN_TERM if WIN else MAC_TERM}</div><p class='note'>" + ("لو سألك Do you want to allow… دوس Yes." if WIN else "لو طلب تثبيت Node.js: دوس Continue و Install، وارجع دوس Enter.") + "</p>",
   ("هَيِفْتَح شِبَّاك، وِيْكَمِّل لِوَحْدُه. لَوْ سَأَلَك تِوافِق عَلَى تَسْطِيب حاجَة، دُوس Yes. ولَمَّا يِكْتِب Done، دُوس Enter عَشان يِقْفِل."
    if WIN else
    "هَيِفْتَح شِبَّاك إِسْوِد، وِيْكَمِّل لِوَحْدُه. لَوْ طَلَب يِسَطَّب Node، دُوس Continue وِ Install لِحَدّ ما يِخْلَص، وارْجَع دُوس Enter. ولَمَّا يِكْتِب Done، دُوس Enter عَشان يِقْفِل.")),
  ("<div class='step'>الخطوة 4 — مرة واحدة بس</div><h1>ضيف البلجن لـ Figma</h1>" + chips("Plugins", "Development", "Import plugin from manifest…") +
   (keys("File name", "Ctrl V", "Enter") if WIN else keys("⌘ ⇧ G", "⌘ V", "Enter", "Open")) + "<p class='note'>المسار اتنسخ لوحده — كل اللي عليك Paste.</p>",
   "تالِت خُطْوَة، مَرَّة واحْدَة بَسّ: اِفْتَح Figma، وافْتَح مِلَفّ التَّصْمِيم. مِن القايْمَة اخْتار Plugins، وبَعْدِين Development، وبَعْدِين Import plugin from manifest. " +
   ("ولَمَّا يِفْتَح شِبَّاك اخْتِيار المِلَفّ، دُوس فِي خانِةْ File name، وبَعْدِين Control V، وبَعْدِين Enter." if WIN else "دُوس Command Shift G، وبَعْدِين Command V، وبَعْدِين Enter، وبَعْدِين Open.")),
  ("<div class='step'>كل مرة تشتغل</div><h1>شغّل البلجن وسيبه مفتوح</h1>" + chips("Plugins", "Development", "Figma Local Bridge") + f"<div class='row'>{PLUGIN_UI}<p class='big'>النقطة الخضرا<br>= متصل ✓</p></div>",
   "كُلّ مَرَّة تِشْتَغَل: شَغَّل البلجن مِن Plugins، وبَعْدِين Development، وبَعْدِين Figma Local Bridge. هَيِظْهَر شِبَّاك صُغَيَّر، سِيبُه مَفْتُوح. لَوْ النُّقْطَة خَضْرا، يِبْقَى الاِتِّصال شَغَّال."),
  ("<div class='step'>كل مرة تشتغل</div><h1>افتح Claude</h1><div class='row'><div class='term' style='font-size:36px'>" + ("PS&gt; " if WIN else "$ ") + "<span class='ok'>claude</span></div><p>" + ("من <b>PowerShell</b>" if WIN else "من <b>Terminal</b>") + " اكتب <b>claude</b><br>أو افتح <b>تطبيق Claude</b><br><span style='font-size:32px;color:#c9b6ff'>أول مرة: اقفل التطبيق خالص وافتحه تاني</span></p></div>",
   ("بَعْد كِدَه اِفْتَح Claude: يا مِن PowerShell، تِكْتِب claude، وِتْدُوس Enter.. يا تِفْتَح تَطْبِيق Claude. أَوِّل مَرَّة، اِقْفِل التَّطْبِيق خالِص، وافْتَحُه تانِي."
    if WIN else
    "بَعْد كِدَه اِفْتَح Claude: يا مِن Terminal، تِكْتِب claude، وِتْدُوس Enter.. يا تِفْتَح تَطْبِيق Claude. أَوِّل مَرَّة، اِقْفِل التَّطْبِيق خالِص، وافْتَحُه تانِي.")),
  ("<div class='step'>جرّب</div><h1>اطلب من Claude بالعربي</h1><div style='display:flex;flex-direction:column'><div class='bubble me'>اتأكد إنك متصل بـ Figma</div><div class='bubble cl'>✓ Connected — file: My Design, page: Screens</div><div class='bubble me'>اعمل تقرير للصفحة: الشاشات المتكررة والأسماء الغلط</div><div class='bubble me'>اقترح أسماء صح وما تغيّرش حاجة غير لما أوافق</div></div>",
   "دِلْوَقْتِي اكْتِب لِـ Claude اللِّي إِنْتَ عايْزُه. مَثَلاً: اِتْأَكِّد إِنَّك مِتْوَصِّل بِـ Figma.. أَوْ: اِعْمِل تَقْرِير لِلصَّفْحَة، فِيه الشَّاشات المِتْكَرَّرَة، والأَسامِي الغَلَط.. أَوْ: اِقْتَرَح أَسامِي صَحّ، وما تْغَيَّرْش حاجَة غِير لَمَّا أَوافِق."),
  ("<div class='step'>أمان</div><h1>مفيش حاجة بتتمسح</h1><ul><li>البلجن مش بيمسح ولا بيغيّر ألوان أو نصوص</li><li>Claude بيوريك التغيير ويستنى موافقتك</li><li>أي تغيير يترجع: قول «رجّع آخر تغيير»</li></ul>",
   "ما تِقْلَقْش.. البلجن مَبِيِمْسَحْش أَيّ حاجَة، وِمَبِيْغَيَّرْش الأَلْوان ولا الكَلام. Claude بِيْوَرِّيك التَّغْيِير الأَوِّل، وِيِسْتَنَّى مُوافْقِتَك. وأَيّ تَغْيِير يِتْرِجِع: قُول بَسّ، رَجَّع آخِر تَغْيِير."),
  ("<div class='step'>لو حاجة مش شغالة</div><h1>أشهر 3 مشاكل</h1><ul><li>النقطة حمرا ← Claude مش مفتوح</li><li>مش لاقي Development ← الملف view only، غيّر الحساب</li>" +
   ("<li>Windows رافض يشغّل الملف ← More info ← Run anyway</li>" if WIN else "<li>الماك رافض يفتح الملف ← كليك يمين ← Open</li>") + "</ul>",
   "لَوْ النُّقْطَة حَمْرا، يِبْقَى Claude مِش مَفْتُوح. لَوْ مِش لاقِي Development، يِبْقَى المِلَفّ مَفْتُوح لِلْعَرْض بَسّ، فاسْتَخْدِم حِساب يِقْدَر يِعَدِّل. " +
   ("ولَوْ Windows رافِض يِشَغَّل المِلَفّ، دُوس More info، وبَعْدِين Run anyway." if WIN else "ولَوْ الماك رافِض يِفْتَح المِلَفّ، دُوس كْلِيك يِمِين، وبَعْدِين Open.")),
  (f"<div class='step'>خلاص كده ✓</div><h1>إنت جاهز تشتغل</h1><p>كل التفاصيل مكتوبة في صفحة الأداة:</p><p class='big' style='direction:ltr;text-align:right;margin-top:20px'>{REPO}</p>",
   "بَسّ كِدَه.. إِنْتَ جاهِز. وكُلّ التَّفاصِيل مَكْتُوبَة فِي صَفْحِةْ الأَداة عَلَى GitHub. بِالتَّوْفِيق."),
]

# 1) voice-over: one continuous take, cut per scene
lines_file = BUILD / "lines.json"
lines_file.write_text(json.dumps({"lines": [s for _, s in SCENES], "eleven": ELEVEN, "takes": 2}, ensure_ascii=False), encoding="utf-8")
out = subprocess.run(["node", str(HERE / "voice" / "run.mjs"), str(lines_file), str(BUILD / "vo")], capture_output=True, text=True)
if out.returncode:
    sys.exit(out.stderr[-2000:])
vo = json.loads(out.stdout.strip().splitlines()[-1])
print("\n".join(vo["report"]))

# 2) slides + per-scene clips
parts = []
for i, ((body, _), clip) in enumerate(zip(SCENES, vo["clips"]), 1):
    h, png, mp4 = BUILD / f"s{i:02}.html", BUILD / f"s{i:02}.png", BUILD / f"s{i:02}.mp4"
    h.write_text(page(body), encoding="utf-8")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--screenshot={png}", "--window-size=1920,1080", h.as_uri()], check=True, capture_output=True)
    voice = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clip], capture_output=True, text=True, check=True).stdout)
    dur = voice + 1.0
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", str(png), "-i", clip,
        "-filter_complex", f"[0:v]scale=1920:1080,fade=t=in:st=0:d=0.35,fade=t=out:st={dur-0.35:.2f}:d=0.35,format=yuv420p[v];[1:a]adelay=450|450,apad,aresample=44100[a]",
        "-map", "[v]", "-map", "[a]", "-t", f"{dur:.2f}", "-r", "30", "-c:v", "libx264", "-tune", "stillimage", "-c:a", "aac", "-ac", "2", str(mp4)], check=True)
    parts.append(mp4)
    print(f"scene {i:02}: {dur:.1f}s")

(BUILD / "list.txt").write_text("".join(f"file '{p}'\n" for p in parts))
final = HERE / f"figma-local-kit-guide-{PLATFORM}.mp4"
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(BUILD / "list.txt"), "-c", "copy", "-movflags", "+faststart", str(final)], check=True)
print("video:", final)
