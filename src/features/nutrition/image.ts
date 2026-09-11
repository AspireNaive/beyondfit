/**
 * Photos go to the API as base64 JSON, so they are downsized in the browser
 * first: ~1024 px on the long edge for analysis and storage, and a small
 * thumbnail for the diary list. A phone camera JPEG of 4–8 MB becomes ~150 KB.
 */
export type PreparedPhoto = { readonly photoDataUrl: string; readonly thumbDataUrl: string }

/**
 * Decode the chosen file into something a canvas can draw. `createImageBitmap`
 * reads the File directly and needs no URL at all; older browsers fall back to
 * a `data:` URL, which the site's Content Security Policy allows for images.
 * (A `blob:` object URL is deliberately avoided — the CSP blocks it.)
 */
type Drawable = ImageBitmap | HTMLImageElement

const sizeOf = (img: Drawable) =>
  'naturalWidth' in img ? { width: img.naturalWidth, height: img.naturalHeight } : { width: img.width, height: img.height }

async function loadImage(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Unsupported format for this browser (e.g. HEIC on desktop) — try the <img> route.
    }
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('That file could not be read.'))
    reader.readAsDataURL(file)
  })
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That file could not be read as an image. Try a JPEG or PNG.'))
    img.src = dataUrl
  })
}

function draw(img: Drawable, maxEdge: number, quality: number): string {
  const natural = sizeOf(img)
  const scale = Math.min(1, maxEdge / Math.max(natural.width, natural.height))
  const width = Math.max(1, Math.round(natural.width * scale))
  const height = Math.max(1, Math.round(natural.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image processing is not available in this browser.')
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo (JPEG, PNG, HEIC or WebP).')
  const img = await loadImage(file)
  const prepared = { photoDataUrl: draw(img, 1024, 0.82), thumbDataUrl: draw(img, 240, 0.7) }
  if ('close' in img) img.close()
  return prepared
}
