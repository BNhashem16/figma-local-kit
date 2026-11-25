// One continuous ElevenLabs take for the whole reel script, split per scene at the natural pauses.
// Separate per-line generation changes tone and pace from line to line (the clearest "AI" tell); one take keeps
// the narrator's breath, rhythm and energy consistent, like a real voice-over session.
import { writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { apiKey } from './key.mjs';

const strip = s => s.replace(/\[[^\]]*\]/g, '').replace(/[ً-ْـ]/g, '');

async function takeWithTimestamps(text, o, out) {
  const body = { text, model_id: o.model ?? 'eleven_v3', voice_settings: { stability: o.stability ?? 0.5, similarity_boost: o.similarity ?? 0.8, style: o.style ?? 0, use_speaker_boost: true, speed: o.speed ?? 1 }, seed: o.seed };
  if (o.dictionary) body.pronunciation_dictionary_locators = [o.dictionary];
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${o.voiceId}/with-timestamps?output_format=mp3_44100_128`, { method: 'POST', headers: { 'xi-api-key': apiKey(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  writeFileSync(out, Buffer.from(j.audio_base64, 'base64'));
  return j.alignment;
}

/** Scene boundaries (seconds) in a take: cut in the middle of the silence between two lines. */
function boundaries(alignment, ranges, total) {
  const { characters: ch, character_start_times_seconds: st, character_end_times_seconds: en } = alignment;
  const spoken = ([a, b]) => { // first/last non-tag, non-space character of a line
    let inTag = false, first = -1, last = -1;
    for (let i = a; i < b && i < ch.length; i++) {
      if (ch[i] === '[') inTag = true;
      if (!inTag && ch[i].trim()) { if (first < 0) first = i; last = i; }
      if (ch[i] === ']') inTag = false;
    }
    return [st[first], en[last]];
  };
  const spans = ranges.map(spoken);
  const cuts = [0];
  for (let i = 1; i < spans.length; i++) cuts.push([spans[i - 1][1], spans[i][0]]);
  cuts.push(total);
  return cuts;
}

/** Snap each cut to the middle of the longest silence near the gap between two lines, so no word is clipped. */
function snapCuts(mp3, cuts) {
  const sr = 16000;
  const pcm = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', mp3, '-f', 'f32le', '-ac', '1', '-ar', String(sr), '-'], { maxBuffer: 1 << 28 });
  const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4);
  const hop = Math.round(0.01 * sr);
  const frames = Math.floor(x.length / hop);
  const db = new Float32Array(frames);
  let peak = 1e-9;
  for (let f = 0; f < frames; f++) { let e = 0; for (let k = f * hop; k < (f + 1) * hop; k++) e += x[k] * x[k]; db[f] = 10 * Math.log10(e / hop + 1e-12); peak = Math.max(peak, db[f]); }
  const quiet = peak - 35; // dB below the loudest 10 ms frame
  return cuts.map(c => {
    if (!Array.isArray(c)) return c;
    const [endPrev, startNext] = c;
    const lo = Math.max(0, Math.floor((Math.min(endPrev, startNext) - 0.25) / 0.01)), hi = Math.min(frames - 1, Math.ceil((Math.max(endPrev, startNext) + 0.25) / 0.01));
    let best = null, runStart = -1;
    for (let f = lo; f <= hi + 1; f++) {
      const q = f <= hi && db[f] < quiet;
      if (q && runStart < 0) runStart = f;
      if (!q && runStart >= 0) {
        const len = f - runStart, mid = (runStart + f) / 2 * 0.01;
        const score = len - Math.abs(mid - (endPrev + startNext) / 2) * 20; // prefer long runs near the gap
        if (!best || score > best.score) best = { score, mid };
        runStart = -1;
      }
    }
    if (best) return best.mid;
    let m = lo; for (let f = lo; f <= hi; f++) if (db[f] < db[m]) m = f; // no silence: quietest frame
    return (m + 0.5) * 0.01;
  });
}

/** Cut a take into one WAV per line. Trimming happens inside the filter so the fades use clip-local time. */
export function splitTake(mp3, cuts, n, prefix) {
  return Array.from({ length: n }, (_, i) => {
    const f = `${prefix}.s${i}.wav`, len = cuts[i + 1] - cuts[i];
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp3, '-af',
      `atrim=start=${cuts[i]}:end=${cuts[i + 1]},asetpts=PTS-STARTPTS,highpass=f=70,afade=t=in:d=0.012,afade=t=out:st=${Math.max(0, len - 0.012)}:d=0.012`,
      '-ar', '44100', '-ac', '1', f]);
    return f;
  });
}

/** Re-split a saved take (out/.vo/<key>.take.mp3 + .take.json) without generating new audio. */
export function resplit(voDir, key) {
  const { ranges, alignment } = JSON.parse(readFileSync(`${voDir}/${key}.take.json`, 'utf8'));
  const mp3 = `${voDir}/${key}.take.mp3`;
  const total = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString());
  return splitTake(mp3, snapCuts(mp3, boundaries(alignment, ranges, total)), ranges.length, `${voDir}/${key}`);
}

/**
 * @returns {Promise<{clips: string[], report: string[]}>} one WAV per `say` line, in order
 */
export async function voiceTake({ lines, eleven, takes = 2, seed = 7, voDir, root, vowelChecks = [] }) {
  if ((eleven.model ?? 'eleven_v3') !== 'eleven_v3') { lines = lines.map(l => l.replace(/\[[^\]]*\]\s*/g, '').trim()); }
  const sep = ' ';
  let text = '', ranges = [];
  for (const l of lines) { const a = text.length; text += (text ? sep : '') + l; ranges.push([a + (a ? sep.length : 0), text.length]); }
  const key = createHash('sha1').update(`take2|${JSON.stringify(eleven)}|${takes}|${seed}|${text}`).digest('hex').slice(0, 16);
  const clips = lines.map((_, i) => `${voDir}/${key}.s${i}.wav`);
  if (clips.every(existsSync)) return { clips, report: ['voice: cached take'] };

  const report = [];
  const cands = [];
  for (let k = 0; k < takes; k++) {
    const mp3 = `${voDir}/${key}.t${k}.mp3`;
    const al = await takeWithTimestamps(text, { ...eleven, seed: seed + k }, mp3);
    const total = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString());
    const cuts = snapCuts(mp3, boundaries(al, ranges, total));
    const parts = splitTake(mp3, cuts, lines.length, `${voDir}/${key}.t${k}`);
    cands.push({ mp3, al, parts, penalty: 0, notes: [] });
  }

  // vowel checks: lines containing a watched word must show the expected phonemes (e.g. دُفعة -> "d u f")
  const watched = lines.map((l, i) => ({ i, rules: vowelChecks.filter(r => strip(l).includes(r.word)) })).filter(x => x.rules.length);
  if (watched.length) {
    const files = cands.flatMap(c => watched.map(w => resolve(c.parts[w.i])));
    const out = execFileSync('uvx', ['--quiet', '--with', 'transformers', '--with', 'torch', '--with', 'librosa', '--with', 'phonemizer', 'python', resolve(root, 'tts/phonemes.py'), ...files], { cwd: resolve(root, 'tts'), stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const heard = out.trim().split('\n').filter(l => l.includes(': ')).map(l => l.slice(l.indexOf(': ') + 2));
    cands.forEach((c, k) => watched.forEach((w, j) => w.rules.forEach(r => {
      const ph = heard[k * watched.length + j] ?? '';
      const ok = new RegExp(r.expect).test(ph);
      if (!ok) { c.penalty += 1; c.notes.push(`${r.word}: heard "${ph.slice(0, 40)}"`); }
    })));
  }

  // clarity: Whisper character error rate on the whole take
  const picks = `${voDir}/takepick-${process.pid}.json`;
  writeFileSync(picks, JSON.stringify({ score_only: true, jobs: cands.map(c => ({ text: strip(text), cands: [c.mp3], out: c.mp3 })) }));
  const scored = execFileSync('uvx', ['--quiet', '--from', 'mlx-whisper', 'python', resolve(root, 'tts/pick.py'), picks], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n');
  rmSync(picks);
  scored.forEach((line, k) => { cands[k].cer = parseFloat(line); cands[k].heard = line.split('=>')[1]?.trim(); });

  const best = cands.reduce((a, b) => (a.penalty + a.cer <= b.penalty + b.cer ? a : b));
  cands.forEach((c, k) => report.push(`take ${k + 1}: clarity ${c.cer.toFixed(2)}${c.penalty ? `, vowel issues: ${c.notes.join('; ')}` : ', vowels ok'}${c === best ? '  <- chosen' : ''}`));
  report.push(`heard: ${best.heard}`);
  best.parts.forEach((p, i) => execFileSync('cp', [p, clips[i]]));
  execFileSync('cp', [best.mp3, `${voDir}/${key}.take.mp3`]);
  writeFileSync(`${voDir}/${key}.take.json`, JSON.stringify({ text, ranges, alignment: best.al }));
  cands.forEach(c => { rmSync(c.mp3, { force: true }); c.parts.forEach(p => rmSync(p, { force: true })); });
  return { clips, report };
}
