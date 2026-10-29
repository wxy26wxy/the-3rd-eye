declare module "potrace" {
  export type PotraceOptions = {
    turnPolicy?: string; turdSize?: number; alphaMax?: number; optCurve?: boolean; optTolerance?: number;
    threshold?: number; blackOnWhite?: boolean; color?: string; background?: string; width?: number; height?: number;
  };
  export class Potrace {
    constructor(options?: PotraceOptions);
    loadImage(target: string | Buffer, callback: (err: Error | null) => void): void;
    setParameters(options: PotraceOptions): void;
    getPathTag(fillColor?: string, scale?: { x: number; y: number }): string;
    getSVG(): string;
  }
  export function trace(file: string | Buffer, options: PotraceOptions, cb: (err: Error | null, svg: string) => void): void;
}
