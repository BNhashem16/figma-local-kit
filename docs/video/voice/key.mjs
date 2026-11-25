// ElevenLabs key from the environment only. Never commit a key.
export function apiKey() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("Set ELEVENLABS_API_KEY to build the video voice-over.");
  return k.trim();
}
