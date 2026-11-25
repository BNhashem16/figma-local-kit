# Figma Local Bridge

<div dir="rtl">

خلّي Claude يشتغل على ملفات Figma **من على جهازك**: يرتّب ويسمّي الشاشات، يطلع الشاشات المكررة، ويعمل تقرير عن أي صفحة.
كل حاجة بتحصل على جهازك. مش بيستخدم Figma MCP اللي على النت، فمفيش حد أقصى للاستخدام ولا tokens بتضيع على Figma.

## محتاجة إيه قبل ما تبدأي

- جهاز **Mac**.
- برنامج **Figma Desktop** (مش المتصفح)، وتكوني عاملة login بحساب **يقدر يعدّل** على الملف (مش view only).
- اشتراك **Claude** (Pro أو Max).

## التثبيت (مرة واحدة بس، حوالي 5 دقايق)

1. من الصفحة دي دوسي على الزرار الأخضر **Code** ثم **Download ZIP**.
2. افتحي ملف الـ ZIP من الـ Downloads. هيطلع فولدر اسمه `figma-local-kit-main`.
3. جوّه الفولدر، دوسي **كليك يمين** على `Install-Mac.command` ثم **Open**، وبعدين **Open** تاني.
   (أول مرة بس الماك بيسأل لأن الملف متنزّل من النت.)
4. هيفتح شباك أسود. سيبيه يكمّل لوحده:
   - لو Node.js مش موجود، هيفتح لك برنامج تثبيته: دوسي **Continue** و **Install** لحد ما يخلص، وارجعي للشباك الأسود ودوسي **Enter**.
   - لو Claude Code مش موجود، هيثبّته لوحده.
5. لما يكتب **Done ✓** دوسي Enter عشان يقفل.

### ضيفي البلجن لـ Figma (مرة واحدة بس)

1. افتحي Figma Desktop وافتحي ملف التصميم.
2. من القايمة اللي فوق: **Plugins ← Development ← Import plugin from manifest…**
3. دوسي **Cmd + Shift + G**، وبعدين **Cmd + V** (المسار متنسخ جاهز)، وبعدين **Enter**، وبعدين **Open**.

## كل مرة تشتغلي

1. في Figma: **Plugins ← Development ← Figma Local Bridge**. هيظهر شباك صغير. سيبيه مفتوح.
2. افتحي Claude:
   - **Claude Code**: افتحي برنامج Terminal واكتبي `claude` ودوسي Enter (أول مرة هيطلب منك تعملي login).
   - أو **تطبيق Claude Desktop** (اقفليه وافتحيه تاني بعد التثبيت أول مرة).
3. اكتبي لـ Claude مثلًا:
   - `اتأكد إنك متصل بـ Figma`
   - `اعمل تقرير لصفحة production: الشاشات المكررة والأسماء الغلط`
   - `اقترح أسماء صح لشاشات قسم Checkout وما تغيّرش حاجة غير لما أوافق`
   - `رجّع آخر تغيير`
4. لما الشباك الصغير في Figma يبقى فيه **نقطة خضرا** يبقى متصل.

## أمان

- البلجن **مش بيمسح أي حاجة**، ومش بيعمل detach، ومش بيغيّر ألوان أو نصوص أو layout.
- Claude لازم يوريكي التغيير ويستنى موافقتك قبل ما يعدّل.
- أي تغيير ممكن يترجع: قولي لـ Claude **رجّع آخر تغيير**.
- كل حاجة بتتسجل في `~/FigmaLocalKit/logs/`.

## لو حاجة مش شغالة

| المشكلة | الحل |
| --- | --- |
| الماك بيقول الملف من مطوّر غير معروف | كليك يمين على الملف ← Open ← Open |
| النقطة في شباك البلجن حمرا | Claude مش مفتوح. افتحيه واستني ثواني |
| Claude بيقول البلجن مش متصل | في Figma: Plugins ← Development ← Figma Local Bridge |
| مش لاقية Plugins ← Development | الملف مفتوح view only. اعملي login بحساب يقدر يعدّل |
| الكتابة في مربع المسار بتطلع عربي | غيّري الكيبورد لإنجليزي، أو استخدمي Cmd + V بس |
| Claude Desktop مش شايف الأدوات | اقفلي التطبيق خالص (Cmd + Q) وافتحيه تاني |

للإزالة: دوسي كليك يمين على `Uninstall-Mac.command` ← Open.

</div>

---

## English

A local bridge that lets Claude (Claude Code or the Claude desktop app) read and organize the Figma file that is open in Figma Desktop, without the remote Figma MCP server.

```
Claude ──stdio──> figma-local MCP server ──localhost:3846──> Figma plugin (UI iframe) ──> Figma Plugin API
```

**Install:** double-click `Install-Mac.command` (first time: right-click > Open). It copies the kit to `~/FigmaLocalKit`, installs Node.js and Claude Code if missing, registers the `figma-local` MCP server for Claude Code and the Claude desktop app, installs the `figma-local` skill, and copies the plugin manifest path. Then in Figma Desktop: Plugins > Development > Import plugin from manifest.

**Tools:** `figma_status`, `figma_file_info`, `figma_find`, `figma_get_nodes`, `figma_list_children`, `figma_get_texts`, `figma_screenshot`, `figma_page_report`, `figma_rename`, `figma_move`, `figma_set_visibility`, `figma_create_section`, `figma_undo_last_change`.

**Safety:** no delete, detach, component swap, or visual edits. Writes need the current value (`from`) and are capped at 60 per call. Every write is logged in `logs/undo.jsonl` and can be undone. The bridge listens on localhost only, refuses requests from web pages, and uses a token between Claude windows.

**Test:** with Figma open and the plugin running: `node test/smoke.mjs`.
