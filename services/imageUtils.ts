export type ImageNormalizeOptions = {
  maxDimension?: number;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  quality?: number; // Only used for lossy formats (jpeg/webp)
};

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image.'));
    img.src = src;
  });

const canvasToDataUrl = async (
  canvas: HTMLCanvasElement,
  mimeType: ImageNormalizeOptions['mimeType'],
  quality: number
): Promise<string> => {
  if (canvas.toBlob) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mimeType, quality)
    );
    if (blob) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read image blob.'));
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(blob);
      });
    }
  }
  return canvas.toDataURL(mimeType, quality);
};

export const normalizeImageDataUrl = async (
  dataUrl: string,
  options: ImageNormalizeOptions = {}
): Promise<string> => {
  const maxDimension = options.maxDimension ?? 512;
  const mimeType = options.mimeType ?? 'image/jpeg';
  const quality = options.quality ?? 0.82;

  const img = await loadImage(dataUrl);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) return dataUrl;

  const scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
  const targetW = Math.max(1, Math.round(srcW * scale));
  const targetH = Math.max(1, Math.round(srcH * scale));

  if (scale === 1 && (mimeType === 'image/png' || dataUrl.startsWith(`data:${mimeType}`))) {
    return dataUrl;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetW, targetH);

  return await canvasToDataUrl(canvas, mimeType, quality);
};

export const normalizeImageFile = async (
  file: File,
  options: ImageNormalizeOptions = {}
): Promise<string> => {
  const dataUrl = await readFileAsDataUrl(file);
  return await normalizeImageDataUrl(dataUrl, options);
};

