import { useEffect, useState } from 'react'
import { idb } from './db'

const MAX_EDGE = 1800

/** Decode a picked file, downscale large ones, and return a storable blob with its dimensions. */
export async function fileToStored(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file)
  } catch {
    throw new Error(`“${file.name}” is not an image this browser can read.`)
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
  if (scale === 1 && file.size < 1_500_000) {
    const out = { blob: file as Blob, w: bmp.width, h: bmp.height }
    bmp.close()
    return out
  }
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const encode = (type: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.86))
  const blob = (await encode('image/webp')) ?? (await encode('image/jpeg'))
  if (!blob) throw new Error('Could not encode the image.')
  return { blob, w, h }
}

/** Read a picked video's dimensions and duration; the file itself is stored as-is. */
export function videoMeta(file: File): Promise<{ w: number; h: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.muted = true
    v.onloadedmetadata = () => {
      const out = { w: v.videoWidth || 720, h: v.videoHeight || 1280, duration: v.duration }
      URL.revokeObjectURL(url)
      resolve(out)
    }
    v.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`“${file.name}” is not a video this browser can play.`))
    }
    v.src = url
  })
}

/** Load a remote image just far enough to learn its size. */
export function probeUrl(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error('That link did not load as an image.'))
    img.src = url
  })
}

const urls = new Map<string, string>()
const pending = new Map<string, Promise<string>>()

export function blobUrl(id: string): Promise<string> {
  const hit = urls.get(id)
  if (hit) return Promise.resolve(hit)
  let p = pending.get(id)
  if (!p) {
    p = idb.get<Blob>('blobs', id).then((blob) => {
      if (!blob) throw new Error('Missing image')
      const u = URL.createObjectURL(blob)
      urls.set(id, u)
      pending.delete(id)
      return u
    })
    pending.set(id, p)
  }
  return p
}

export function forgetBlobUrl(id: string) {
  const u = urls.get(id)
  if (u) URL.revokeObjectURL(u)
  urls.delete(id)
}

export function useBlobUrl(id: string): string | null {
  const [url, setUrl] = useState<string | null>(() => urls.get(id) ?? null)
  useEffect(() => {
    let on = true
    blobUrl(id).then((u) => on && setUrl(u)).catch(() => on && setUrl(null))
    return () => {
      on = false
    }
  }, [id])
  return url
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

/** Relative luminance — decides whether a label on a tone reads in ink or on-dark. */
export function isDark(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.55
}
