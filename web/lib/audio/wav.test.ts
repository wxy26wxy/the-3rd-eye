import { describe, expect, it } from "vitest";
import { downmix, encodeWav } from "./wav";

const text = (v: DataView, at: number, n: number) => String.fromCharCode(...Array.from({ length: n }, (_, i) => v.getUint8(at + i)));

describe("encodeWav", () => {
  const samples = new Float32Array([0, 1, -1, 0.5, -0.5, 2, -2]);
  const buf = encodeWav(samples, 16_000);
  const v = new DataView(buf);

  it("has the right byte length: 44-byte header + 2 bytes per sample", () => {
    expect(buf.byteLength).toBe(44 + samples.length * 2);
  });

  it("writes RIFF/WAVE header fields for 16 kHz mono 16-bit PCM", () => {
    expect(text(v, 0, 4)).toBe("RIFF");
    expect(v.getUint32(4, true)).toBe(36 + samples.length * 2);
    expect(text(v, 8, 4)).toBe("WAVE");
    expect(text(v, 12, 4)).toBe("fmt ");
    expect(v.getUint32(16, true)).toBe(16);
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(16_000);
    expect(v.getUint32(28, true)).toBe(32_000); // byte rate
    expect(v.getUint16(32, true)).toBe(2); // block align
    expect(v.getUint16(34, true)).toBe(16); // bits per sample
    expect(text(v, 36, 4)).toBe("data");
    expect(v.getUint32(40, true)).toBe(samples.length * 2);
  });

  it("writes little-endian int16 samples, clamped to [-1, 1]", () => {
    const pcm = Array.from({ length: samples.length }, (_, i) => v.getInt16(44 + i * 2, true));
    expect(pcm).toEqual([0, 32767, -32768, 16384, -16384, 32767, -32768]);
  });

  it("60 s of 16 kHz mono stays under 4 MB", () => {
    expect(44 + 60 * 16_000 * 2).toBeLessThan(4 * 1024 * 1024);
  });
});

describe("downmix", () => {
  it("averages channels", () => {
    expect(Array.from(downmix([new Float32Array([1, 0]), new Float32Array([0, 1])]))).toEqual([0.5, 0.5]);
  });
});
