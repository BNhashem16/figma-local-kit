"""Builds docs/video/figma-local-kit-guide.mp4 — slides rendered by Chrome, Arabic narration by macOS `say` (voice Majed).
Run: python3 docs/video/make_video.py
"""
import html, json, pathlib, subprocess

HERE = pathlib.Path(__file__).resolve().parent
BUILD = HERE / "build"
BUILD.mkdir(exist_ok=True)
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
REPO = "github.com/BNhashem16/figma-local-kit"

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{width:1920px;height:1080px;font-family:-apple-system,"SF Arabic","Geeza Pro",sans-serif;background:linear-gradient(135deg,#1b1033,#2d1b5e 60%,#3c2a7a);color:#fff;direction:rtl;overflow:hidden}
.wrap{padding:90px 120px;height:100%;display:flex;flex-direction:column}
.step{font-size:34px;color:#c9b6ff;letter-spacing:1px;margin-bottom:18px}
h1{font-size:76px;line-height:1.25;margin-bottom:34px}
p,li{font-size:42px;line-height:1.6;color:#ece6ff}
ul{list-style:none;margin-top:10px}
li{margin:14px 0;padding-right:56px;position:relative}
li:before{content:"✓";position:absolute;right:0;color:#7cf3a0;font-weight:700}
.row{display:flex;gap:60px;align-items:center;flex:1}
.card{background:#fff;color:#222;border-radius:22px;padding:34px 40px;box-shadow:0 30px 80px rgba(0,0,0,.35);direction:ltr;font-family:-apple-system,sans-serif}
.term{background:#0d0d12;color:#e6e6e6;border-radius:18px;padding:30px 36px;font:28px/1.55 Menlo,monospace;direction:ltr;white-space:pre;box-shadow:0 30px 80px rgba(0,0,0,.4)}
.ok{color:#7cf3a0}.st{color:#c9a3ff;font-weight:700}
.path{display:flex;gap:14px;direction:ltr;align-items:center;flex-wrap:wrap}
.chip{background:#fff;color:#2a1a55;border-radius:14px;padding:16px 26px;font:600 34px -apple-system,sans-serif}
.arrow{font-size:40px;color:#c9b6ff}
.keys{display:flex;gap:16px;direction:ltr;margin-top:30px;flex-wrap:wrap}
.key{background:#2a1d55;border:2px solid #8e75ff;border-radius:14px;padding:12px 22px;font:600 32px -apple-system,sans-serif}
.bubble{border-radius:22px;padding:22px 30px;font-size:36px;margin:14px 0;max-width:1300px}
.me{background:#8e75ff;align-self:flex-start}
.cl{background:#fff;color:#222;align-self:flex-end;direction:ltr;text-align:left;font-family:-apple-system,sans-serif;font-size:30px}
.foot{font-size:30px;color:#b9a8f0;margin-top:auto}
.big{font-size:56px}
"""

def page(body):
    return f"<!doctype html><html><head><meta charset='utf-8'><style>{CSS}</style></head><body><div class='wrap'>{body}</div></body></html>"

def plugin_ui(color, text):
    return f"""<div class='card' style='width:560px'><div style='display:flex;align-items:center;gap:14px;font-size:30px'>
<span style='width:22px;height:22px;border-radius:11px;background:{color};display:inline-block'></span><b>Figma Local Bridge</b></div>
<div style='font-size:28px;margin-top:12px'>{text}</div><div style='color:#888;font-size:24px;margin-top:8px'>Keep this window open while Claude works.</div></div>"""

SCENES = [
  ("Figma Local Bridge",
   f"<div class='step'>دليل التشغيل</div><h1>خلّي Claude يشتغل على ملفات Figma<br>من جهازك</h1><p>من غير Figma MCP اللي على النت — من غير حد أقصى ومن غير tokens زيادة.</p><div class='foot'>{REPO}</div>",
   "أهلاً بك. في هذا الفيديو سنتعلم كيف نشغّل Claude على ملفات فيجما من جهازك مباشرة، خطوة بخطوة، بدون أي برمجة."),
  ("needs",
   "<div class='step'>قبل ما تبدأي</div><h1>محتاجة 3 حاجات</h1><ul><li>جهاز Mac</li><li>برنامج Figma Desktop بحساب يقدر يعدّل على الملف</li><li>اشتراك Claude (Pro أو Max)</li></ul>",
   "قبل أن نبدأ تحتاجين ثلاثة أشياء. جهاز ماك. وبرنامج فيجما ديسكتوب، بحساب يستطيع التعديل على الملف. واشتراك في كلود."),
  ("download",
   f"<div class='step'>الخطوة 1</div><h1>نزّلي الأداة من GitHub</h1><div class='row'><div class='card' style='font-size:34px'><div style='color:#555'>{REPO}</div><div style='margin-top:24px;display:flex;gap:16px'><span style='background:#1f883d;color:#fff;border-radius:10px;padding:12px 24px;font-weight:700'>&lt;&gt; Code ▾</span></div><div style='margin-top:22px;border:1px solid #ddd;border-radius:12px;padding:16px 22px'>⬇︎ Download ZIP</div></div><p>دوسي <b>Code</b><br>ثم <b>Download ZIP</b><br>وافتحي الملف من Downloads</p></div>",
   "الخطوة الأولى. افتحي صفحة الأداة على جيت هاب. اضغطي على الزر الأخضر كود، ثم داونلود زيب. بعد ذلك افتحي الملف من مجلد التنزيلات."),
  ("install",
   "<div class='step'>الخطوة 2</div><h1>شغّلي ملف التثبيت</h1><div class='row'><div class='card' style='font-size:32px;width:620px'><div>📄 Install-Mac.command</div><div style='margin-top:18px;border-top:1px solid #eee;padding-top:14px'><b>Open</b></div><div style='color:#999'>Get Info</div><div style='color:#999'>Rename</div></div><p>كليك يمين على<br><b>Install-Mac.command</b><br>ثم <b>Open</b><br>ثم <b>Open</b> مرة تانية</p></div>",
   "الخطوة الثانية. داخل المجلد، اضغطي بالزر الأيمن على ملف إنستول ماك، واختاري أوبن، ثم أوبن مرة أخرى. هذا مطلوب فقط في المرة الأولى."),
  ("installer",
   "<div class='step'>الخطوة 3</div><h1>استني لحد ما يكتب Done</h1><div class='term'><span class='st'>==&gt; 1/5  Copying files</span>\n    <span class='ok'>✓ Files are in ~/FigmaLocalKit</span>\n<span class='st'>==&gt; 2/5  Checking Node.js</span>\n    <span class='ok'>✓ Node.js v22</span>\n<span class='st'>==&gt; 3/5  Checking Claude Code</span>\n    <span class='ok'>✓ Claude Code is installed</span>\n<span class='st'>==&gt; 4/5  Connecting the bridge to Claude</span>\n    <span class='ok'>✓ Added to Claude Code</span>\n<span class='st'>==&gt; 5/5  Figma plugin</span>\n    <span class='ok'>✓ The plugin path is copied</span>\n\nDone ✓</div><p style='margin-top:26px;font-size:34px'>لو طلب تثبيت Node.js: دوسي Continue و Install، وارجعي دوسي Enter.</p>",
   "سيفتح شباك أسود ويكمل وحده. إذا طلب تثبيت نود، اضغطي كونتينيو ثم إنستول حتى ينتهي، ثم ارجعي واضغطي إنتر. عندما يكتب دَن، اضغطي إنتر لإغلاقه."),
  ("figma-import",
   "<div class="step">الخطوة 4 — مرة واحدة بس</div><h1>ضيفي البلجن لـ Figma</h1><div class='path'><span class='chip'>Plugins</span><span class='arrow'>›</span><span class='chip'>Development</span><span class='arrow'>›</span><span class='chip'>Import plugin from manifest…</span></div><div class='keys'><span class='key'>⌘ ⇧ G</span><span class='key'>⌘ V</span><span class='key'>Enter</span><span class='key'>Open</span></div><p style='margin-top:36px'>المسار اتنسخ لوحده — كل اللي عليكي Paste.</p>",
   "الخطوة الرابعة، مرة واحدة فقط. افتحي فيجما ديسكتوب وافتحي ملف التصميم. من القائمة اختاري بلجنز، ثم ديفيلوبمنت، ثم إمبورت بلجن فروم مانيفست. اضغطي كوماند شيفت جي، ثم كوماند في، ثم إنتر، ثم أوبن."),
  ("run-plugin",
   "<div class='step'>كل مرة تشتغلي</div><h1>شغّلي البلجن وسيبيه مفتوح</h1><div class='path'><span class='chip'>Plugins</span><span class='arrow'>›</span><span class='chip'>Development</span><span class='arrow'>›</span><span class='chip'>Figma Local Bridge</span></div><div class='row'>" + plugin_ui("#2ecc71", "Connected ✓  Waiting for Claude.") + "<p class='big'>النقطة الخضرا<br>= متصل ✓</p></div>",
   "في كل مرة تعملين، شغّلي البلجن من بلجنز، ديفيلوبمنت، فيجما لوكال بريدج. سيظهر شباك صغير، اتركيه مفتوحاً. النقطة الخضراء تعني أن الاتصال يعمل."),
  ("open-claude",
   "<div class='step'>كل مرة تشتغلي</div><h1>افتحي Claude</h1><div class='row'><div class='term' style='font-size:34px'>$ <span class='ok'>claude</span></div><p>من برنامج <b>Terminal</b> اكتبي <b>claude</b><br>أو افتحي <b>تطبيق Claude</b><br><span style='font-size:32px;color:#c9b6ff'>أول مرة: اقفلي التطبيق وافتحيه تاني</span></p></div>",
   "بعد ذلك افتحي كلود. إما من برنامج تيرمينال واكتبي كلود ثم إنتر، أو افتحي تطبيق كلود. في المرة الأولى أغلقي التطبيق وافتحيه من جديد."),
  ("ask",
   "<div class='step'>جربي</div><h1>اطلبي من Claude بالعربي</h1><div style='display:flex;flex-direction:column'><div class='bubble me'>اتأكد إنك متصل بـ Figma</div><div class='bubble cl'>✓ Connected — file: My Design, page: Screens</div><div class='bubble me'>اعمل تقرير لصفحة production: الشاشات المكررة والأسماء الغلط</div><div class='bubble me'>اقترح أسماء صح لقسم Checkout وما تغيّرش غير لما أوافق</div></div>",
   "الآن اكتبي لكلود ما تريدين. مثلاً: تأكد أنك متصل بفيجما. أو: اعمل تقريراً عن الصفحة، يبيّن الشاشات المكررة والأسماء الخاطئة. أو: اقترح أسماء صحيحة، ولا تغيّر شيئاً قبل موافقتي."),
  ("safety",
   "<div class='step'>أمان</div><h1>مفيش حاجة بتتمسح</h1><ul><li>البلجن مش بيمسح ولا بيغيّر ألوان أو نصوص</li><li>Claude بيوريكي التغيير ويستنى موافقتك</li><li>أي تغيير يترجع: قولي «رجّع آخر تغيير»</li></ul>",
   "لا تقلقي. البلجن لا يحذف أي شيء، ولا يغيّر الألوان أو النصوص. كلود يعرض عليك التغيير وينتظر موافقتك. وأي تغيير يمكن إرجاعه: فقط قولي، رجّع آخر تغيير."),
  ("help",
   "<div class='step'>لو حاجة مش شغالة</div><h1>أشهر 3 مشاكل</h1><ul><li>النقطة حمرا ← Claude مش مفتوح</li><li>مش لاقية Development ← الملف view only، غيّري الحساب</li><li>الماك رافض يفتح الملف ← كليك يمين ثم Open</li></ul>",
   "إذا كانت النقطة حمراء، فكلود غير مفتوح. إذا لم تجدي ديفيلوبمنت، فالملف مفتوح للعرض فقط، استخدمي حساباً يستطيع التعديل. وإذا رفض الماك فتح الملف، اضغطي بالزر الأيمن ثم أوبن."),
  ("outro",
   f"<div class='step'>خلاص كده ✓</div><h1>جاهزة تشتغلي</h1><p>كل التفاصيل مكتوبة في صفحة الأداة:</p><p class='big' style='direction:ltr;text-align:right;margin-top:20px'>{REPO}</p>",
   "هذا كل شيء. أنت الآن جاهزة. وكل التفاصيل مكتوبة في صفحة الأداة على جيت هاب. بالتوفيق."),
]

parts = []
for i, (name, body, voice) in enumerate(SCENES, 1):
    h = BUILD / f"s{i:02}.html"; png = BUILD / f"s{i:02}.png"; aiff = BUILD / f"s{i:02}.aiff"; mp4 = BUILD / f"s{i:02}.mp4"
    h.write_text(page(body), encoding="utf-8")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--screenshot={png}", "--window-size=1920,1080", h.as_uri()], check=True, capture_output=True)
    subprocess.run(["say", "-v", "Majed", "-r", "165", "-o", str(aiff), voice], check=True)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(aiff)], capture_output=True, text=True, check=True).stdout) + 1.2
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", str(png), "-i", str(aiff),
        "-filter_complex", f"[0:v]scale=1920:1080,fade=t=in:st=0:d=0.4,fade=t=out:st={dur-0.4:.2f}:d=0.4,format=yuv420p[v];[1:a]adelay=400|400,apad[a]",
        "-map", "[v]", "-map", "[a]", "-t", f"{dur:.2f}", "-r", "30", "-c:v", "libx264", "-tune", "stillimage", "-c:a", "aac", "-ar", "44100", "-ac", "2", str(mp4)], check=True)
    parts.append(mp4)
    print(f"scene {i:02} {name}: {dur:.1f}s")

lst = BUILD / "list.txt"
lst.write_text("".join(f"file '{p}'\n" for p in parts))
out = HERE / "figma-local-kit-guide.mp4"
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", "-movflags", "+faststart", str(out)], check=True)
print("video:", out)
