// node run.mjs <lines.json> <cacheDir>  -> prints JSON {clips, report}
// One continuous ElevenLabs take for the whole script, best of N takes by Whisper clarity, cut per scene.
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { voiceTake } from "./voice-take.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const [linesFile, voDir] = process.argv.slice(2);
const { lines, eleven, takes } = JSON.parse(readFileSync(linesFile, "utf8"));
mkdirSync(voDir, { recursive: true });
const r = await voiceTake({ lines, eleven, takes, voDir: resolve(voDir), root: here });
console.log(JSON.stringify(r));
