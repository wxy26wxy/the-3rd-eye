/**
 * 16-bit PCM WAV encoding for speech uploads. Muse Voice Transcribe accepts WAV only, so the
 * web recorder converts whatever MediaRecorder produced (webm/opus, mp4/aac) to mono 16 kHz WAV.
 * 16 kHz mono 16-bit is 32 000 bytes/s (about 1.9 MB per minute), well under the 4 MB limit.
 */
export const SPEECH_SAMPLE_RATE = 16_000;
const HEADER_BYTES = 44;

/** Encode mono float samples in [-1, 1] as a RIFF/WAVE 16-bit PCM file. Pure; runs anywhere. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataBytes = samples.length * 2;
  const buf = new ArrayBuffer(HEADER_BYTES + dataBytes);
  const v = new DataView(buf);
  const ascii = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i)); };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);      // RIFF chunk size
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);                 // fmt chunk size
  v.setUint16(20, 1, true);                  // audio format: PCM
  v.setUint16(22, 1, true);                  // channels: mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);     // byte rate = rate * channels * 2
  v.setUint16(32, 2, true);                  // block align
  v.setUint16(34, 16, true);                 // bits per sample
  ascii(36, "data");
  v.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(HEADER_BYTES + i * 2, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
  }
  return buf;
}

/** Average all channels into one. */
export function downmix(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] += ch[i] / channels.length;
  return out;
}

/**
 * Browser only: decode a recorded blob, downmix to mono, resample to 16 kHz (OfflineAudioContext)
 * and return `audio/wav`. `maxSeconds` trims anything longer (the API limit is 60 s).
 */
export async function blobToWav(blob: Blob, maxSeconds = 60): Promise<Blob> {
  const Ctx: typeof AudioContext = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    void ctx.close();
  }
  const mono = downmix(Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i)));
  let samples = mono;
  if (decoded.sampleRate !== SPEECH_SAMPLE_RATE) {
    const length = Math.ceil(decoded.duration * SPEECH_SAMPLE_RATE);
    const offline = new OfflineAudioContext(1, length, SPEECH_SAMPLE_RATE);
    const src = offline.createBuffer(1, mono.length, decoded.sampleRate);
    src.copyToChannel(mono as Float32Array<ArrayBuffer>, 0);
    const node = offline.createBufferSource();
    node.buffer = src;
    node.connect(offline.destination);
    node.start();
    samples = (await offline.startRendering()).getChannelData(0);
  }
  const limit = Math.floor(maxSeconds * SPEECH_SAMPLE_RATE);
  if (samples.length > limit) samples = samples.subarray(0, limit);
  return new Blob([encodeWav(samples, SPEECH_SAMPLE_RATE)], { type: "audio/wav" });
}
