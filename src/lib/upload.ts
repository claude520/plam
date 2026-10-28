// 图片上传：浏览器端压缩为 JPEG → 线上环境存入 D1 assets 表（/api/asset/:id），无后端时退回 data URL
import { useDB } from '@/store/db'

export function pickFiles(accept = 'image/*', multiple = false): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = accept; input.multiple = multiple
    input.onchange = () => resolve(Array.from(input.files ?? []))
    input.oncancel = () => resolve([])
    input.click()
  })
}

export function compressImage(file: File, max = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const im = new Image()
    im.onload = () => {
      const scale = Math.min(1, max / Math.max(im.width, im.height))
      const c = document.createElement('canvas'); c.width = Math.round(im.width * scale); c.height = Math.round(im.height * scale)
      c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片读取失败')) }
    im.src = url
  })
}

/** 裁剪为指定宽高比（居中裁剪），返回 data URL */
export function cropToRatio(src: string, ratio: number, size = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const im = new Image(); im.crossOrigin = 'anonymous'
    im.onload = () => {
      const w = size, h = Math.round(size / ratio)
      const sr = im.width / im.height
      let sw = im.width, sh = im.height, sx = 0, sy = 0
      if (sr > ratio) { sw = im.height * ratio; sx = (im.width - sw) / 2 } else { sh = im.width / ratio; sy = (im.height - sh) / 2 }
      const c = document.createElement('canvas'); c.width = w; c.height = h
      try { c.getContext('2d')!.drawImage(im, sx, sy, sw, sh, 0, 0, w, h); resolve(c.toDataURL('image/jpeg', 0.85)) } catch (e) { reject(e) }
    }
    im.onerror = () => reject(new Error('图片加载失败'))
    im.src = src
  })
}

export async function uploadDataUrl(dataUrl: string): Promise<string> {
  if (!useDB.getState()._remote) return dataUrl
  try {
    const r = await fetch('/api/asset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: dataUrl }) })
    const j = (await r.json()) as { url?: string }
    return j.url ?? dataUrl
  } catch { return dataUrl }
}

export async function uploadImageFile(file: File, max = 1200): Promise<string> {
  const data = await compressImage(file, max)
  return uploadDataUrl(data)
}

/** 字符数：中文算 2 个字符（与淘宝「30个汉字（60字符）」口径一致） */
export const charLen = (s: string) => Array.from(s).reduce((a, ch) => a + (/[^\x00-\xff]/.test(ch) ? 2 : 1), 0)
export const clampChars = (s: string, max: number) => { let out = ''; for (const ch of Array.from(s)) { if (charLen(out + ch) > max) break; out += ch } return out }
