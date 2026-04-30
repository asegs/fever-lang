import sdl from '@kmamal/sdl';

export type RGB = [number, number, number];

export class PixelWindow {
  public readonly width: number;
  public readonly height: number;
  public readonly pixels: Uint8Array;

  private window: any;
  private stride: number;

  constructor(width: number, height: number, title = '') {
    this.width = width;
    this.height = height;

    // RGBA buffer
    this.pixels = Buffer.alloc(width * height * 4);
    this.stride = width * 4;

    this.window = sdl.video.createWindow({
      title,
      width,
      height,
    });
  }

  setPixel(x: number, y: number, [r, g, b]: RGB): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;

    const i = (y * this.width + x) * 4;
    this.pixels[i] = r;
    this.pixels[i + 1] = g;
    this.pixels[i + 2] = b;
    this.pixels[i + 3] = 255;
  }

  clear([r, g, b]: RGB = [0, 0, 0]): void {
    for (let i = 0; i < this.pixels.length; i += 4) {
      this.pixels[i] = r;
      this.pixels[i + 1] = g;
      this.pixels[i + 2] = b;
      this.pixels[i + 3] = 255;
    }
  }

  present(): void {
    // Push buffer directly to window
    this.window.render(
      this.width,
      this.height,
      this.stride,
      'rgba32',
      this.pixels
    );
  }

  destroy(): void {
    this.window.destroy();
  }
}