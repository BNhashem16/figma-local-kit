# Figma Local Bridge

🎬 **فيديو الشرح:** [Mac](docs/video/figma-local-kit-guide-mac.mp4) · [Windows](docs/video/figma-local-kit-guide-windows.mp4)

<div dir="rtl">

خلّي Claude يشتغل على ملفات Figma **من على جهازك**: يرتّب ويسمّي الشاشات، يطلّع الشاشات المتكررة، ويعمل تقرير عن أي صفحة.
كل حاجة بتحصل على جهازك. مش بيستخدم Figma MCP اللي على النت، فمفيش حد أقصى للاستخدام ولا tokens بتضيع.

## محتاج إيه قبل ما تبدأ

- جهاز **Mac** أو **Windows**.
- برنامج **Figma Desktop** (مش المتصفح)، وتكون عامل login بحساب **يقدر يعدّل** على الملف (مش view only).
- اشتراك **Claude** (Pro أو Max).

## التثبيت على Mac (مرة واحدة، حوالي 5 دقايق)

1. من الصفحة دي دوس على الزرار الأخضر **Code** وبعدين **Download ZIP**.
2. افتح ملف الـ ZIP من الـ Downloads. هيطلع فولدر اسمه `figma-local-kit-main`.
3. جوّه الفولدر، دوس **كليك يمين** على `Install-Mac.command` وبعدين **Open**، وبعدين **Open** تاني.
   (أول مرة بس، لأن الماك بيسأل عن أي ملف متنزّل من النت.)
4. هيفتح شباك أسود ويكمّل لوحده:
   - لو Node.js مش موجود، هيفتحلك برنامج تثبيته: دوس **Continue** و **Install** لحد ما يخلص، وارجع للشباك الأسود ودوس **Enter**.
   - لو Claude Code مش موجود، هيثبّته لوحده.
5. لما يكتب **Done ✓** دوس Enter عشان يقفل.
6. في Figma (مرة واحدة): **Plugins ← Development ← Import plugin from manifest…** وبعدين **Cmd + Shift + G** وبعدين **Cmd + V** وبعدين **Enter** وبعدين **Open**.

## التثبيت على Windows (مرة واحدة، حوالي 5 دقايق)

1. من الصفحة دي دوس على الزرار الأخضر **Code** وبعدين **Download ZIP**.
2. في الـ Downloads دوس **كليك يمين** على ملف الـ ZIP وبعدين **Extract All** وبعدين **Extract**.
3. جوّه الفولدر، دوس **دبل كليك** على `Install-Windows.bat`.
   لو ظهرت رسالة زرقا من Windows: دوس **More info** وبعدين **Run anyway**.
4. هيفتح شباك ويكمّل لوحده. لو طلب تثبيت Node.js أو سألك "Do you want to allow…" دوس **Yes**.
5. لما يكتب **Done** دوس Enter عشان يقفل.
6. في Figma (مرة واحدة): **Plugins ← Development ← Import plugin from manifest…** وفي شباك اختيار الملف دوس على خانة **File name** وبعدين **Ctrl + V** وبعدين **Enter**.

## كل مرة تشتغل

1. في Figma افتح ملف التصميم، وبعدين **Plugins ← Development ← Figma Local Bridge**. هيظهر شباك صغير. سيبه مفتوح.
2. افتح Claude:
   - **Claude Code**: افتح Terminal (على Mac) أو PowerShell (على Windows) واكتب `claude` ودوس Enter. أول مرة هيطلب منك login.
   - أو **تطبيق Claude**. أول مرة بعد التثبيت اقفله خالص وافتحه تاني.
3. لما الشباك الصغير في Figma يبقى فيه **نقطة خضرا** يبقى متصل.
4. اكتب لـ Claude مثلًا:
   - `اتأكد إنك متصل بـ Figma`
   - `اعمل تقرير لصفحة production: الشاشات المتكررة والأسماء الغلط`
   - `اقترح أسماء صح لشاشات قسم Checkout وما تغيّرش حاجة غير لما أوافق`
   - `رجّع آخر تغيير`

## أمان

- البلجن **مش بيمسح أي حاجة**، ومش بيعمل detach، ومش بيغيّر ألوان أو نصوص أو layout.
- Claude لازم يوريك التغيير ويستنى موافقتك قبل ما يعدّل.
- أي تغيير ممكن يترجع: قول لـ Claude **رجّع آخر تغيير**.
- كل حاجة بتتسجل في فولدر `FigmaLocalKit/logs` في الـ home بتاعك.

## لو حاجة مش شغالة

| المشكلة | الحل |
| --- | --- |
| الماك بيقول الملف من مطوّر غير معروف | كليك يمين على الملف ← Open ← Open |
| Windows بيقول "Windows protected your PC" | More info ← Run anyway |
| النقطة في شباك البلجن حمرا | Claude مش مفتوح. افتحه واستنى ثواني |
| Claude بيقول البلجن مش متصل | في Figma: Plugins ← Development ← Figma Local Bridge |
| مش لاقي Plugins ← Development | الملف مفتوح view only. اعمل login بحساب يقدر يعدّل |
| الكتابة في مربع المسار بتطلع عربي | استخدم Paste بس (Cmd + V أو Ctrl + V)، المسار متنسخ جاهز |
| تطبيق Claude مش شايف الأدوات | اقفل التطبيق خالص وافتحه تاني |

للإزالة: `Uninstall-Mac.command` على Mac، أو `Uninstall-Windows.bat` على Windows.

</div>

---

## English

A local bridge that lets Claude (Claude Code or the Claude desktop app) read and organize the Figma file that is open in Figma Desktop, without the remote Figma MCP server. Works on macOS and Windows.

```
Claude ──stdio──> figma-local MCP server ──localhost:3846──> Figma plugin (UI iframe) ──> Figma Plugin API
```

**Install:** macOS: `Install-Mac.command` (first time: right-click > Open). Windows: `Install-Windows.bat`. The installer copies the kit to `~/FigmaLocalKit` (`%USERPROFILE%\FigmaLocalKit`), installs Node.js and Claude Code if missing, registers the `figma-local` MCP server for Claude Code and the Claude desktop app, installs the `figma-local` skill, and copies the plugin manifest path. Then in Figma Desktop: Plugins > Development > Import plugin from manifest.

**Tools:** `figma_status`, `figma_file_info`, `figma_find`, `figma_get_nodes`, `figma_list_children`, `figma_get_texts`, `figma_screenshot`, `figma_page_report`, `figma_rename`, `figma_move`, `figma_set_visibility`, `figma_create_section`, `figma_undo_last_change`.

**Safety:** no delete, detach, component swap, or visual edits. Writes need the current value (`from`) and are capped at 60 per call. Every write is logged in `logs/undo.jsonl` and can be undone. The bridge listens on localhost only, refuses requests from web pages, and uses a token between Claude windows.

**Test:** with Figma open and the plugin running: `node test/smoke.mjs`.

**Video:** `docs/video/make_video.py mac|windows` (slides rendered by Chrome, Egyptian voice-over by ElevenLabs; needs `ELEVENLABS_API_KEY`).
