export interface RewildV4AtlasFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RewildV4DrawOptions {
  scale?: number;
  alpha?: number;
  flipX?: boolean;
  rotation?: number;
}

// Shared by app/rewild-entity-atlas-v4.ts and app/rewild-structure-atlas-v4.ts: both atlases
// preload one image and draw a frame from it centered at (x, y) the same way, differing only in
// their id/frame table and an optional native-scale compensation constant.
export function createRewildV4AtlasRuntime<Id extends string>(
  url: string,
  frames: Record<Id, RewildV4AtlasFrame>,
  label: string,
) {
  let image: HTMLImageElement | null = null;
  let ready: Promise<HTMLImageElement> | null = null;

  function preload() {
    if (typeof Image === "undefined") return Promise.resolve<HTMLImageElement | null>(null);
    if (image?.complete && image.naturalWidth > 0) return Promise.resolve(image);
    ready ??= new Promise<HTMLImageElement>((resolve, reject) => {
      const next = image ?? new Image();
      next.onload = () => { image = next; resolve(next); };
      next.onerror = () => reject(new Error(`Failed to load Rewild v4 ${label} atlas: ${url}`));
      if (!image) {
        image = next;
        next.src = url;
      }
    });
    return ready;
  }

  function preloadAtlas() {
    return preload().then(() => undefined);
  }

  function drawSprite(
    ctx: CanvasRenderingContext2D,
    id: Id,
    x: number,
    y: number,
    options: RewildV4DrawOptions = {},
    nativeScale = 1,
  ) {
    if (typeof Image !== "undefined" && !ready) void preload();
    if (!image?.complete || image.naturalWidth <= 0) return false;
    const frame = frames[id];
    const scale = (options.scale ?? 1) * nativeScale;
    const width = Math.max(1, Math.round(frame.width * scale));
    const height = Math.max(1, Math.round(frame.height * scale));

    ctx.save();
    ctx.globalAlpha *= options.alpha ?? 1;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.round(x), Math.round(y));
    if (options.rotation) ctx.rotate(options.rotation);
    if (options.flipX) ctx.scale(-1, 1);
    ctx.drawImage(
      image,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      -Math.round(width / 2),
      -Math.round(height / 2),
      width,
      height,
    );
    ctx.restore();
    return true;
  }

  return { preloadAtlas, drawSprite };
}
