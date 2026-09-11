/**
 * Photos go to the API as base64 JSON, so they are downsized in the browser
 * first: ~1024 px on the long edge for analysis and storage, and a small
 * thumbnail for the diary list. A phone camera JPEG of 4–8 MB becomes ~150 KB.
 */
export type PreparedPhoto = { readonly photoDataUrl: string; readonly thumbDataUrl: string }

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file could not be read as an image.'))
    }
    img.src = url
  })

function draw(img: HTMLImageElement, maxEdge: number, quality: number): string {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))
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
  return { photoDataUrl: draw(img, 1024, 0.82), thumbDataUrl: draw(img, 240, 0.7) }
}
