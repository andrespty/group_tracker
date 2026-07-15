import { supabase } from './supabase.js'

const BUCKET = 'entry-photos'

// The ONE place that turns a stored path into a URL. Everything else in
// the app only ever touches photo_path/thumb_path (what's in the
// database) — never a URL — so swapping this bucket to private/signed
// URLs later is a one-function change, not a find-and-replace.
export const photoUrl = (path) =>
  path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null

async function compress(file, { maxDim, quality }) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process that image'))),
      'image/jpeg',
      quality
    )
  })
}

// Compresses to a full (max 1600px, ~200KB) and thumb (max 400px, ~20KB)
// JPEG, uploads both directly to the bucket, and returns their paths.
// Throws on any failure — callers decide whether that should block
// logging the entry (it shouldn't; see LogDialog).
export async function uploadEntryPhoto(file, groupId) {
  const id = crypto.randomUUID()
  const photoPath = `${groupId}/${id}.jpg`
  const thumbPath = `${groupId}/${id}_thumb.jpg`

  const [full, thumb] = await Promise.all([
    compress(file, { maxDim: 1600, quality: 0.8 }),
    compress(file, { maxDim: 400, quality: 0.7 }),
  ])

  const [a, b] = await Promise.all([
    supabase.storage.from(BUCKET).upload(photoPath, full, { contentType: 'image/jpeg' }),
    supabase.storage.from(BUCKET).upload(thumbPath, thumb, { contentType: 'image/jpeg' }),
  ])
  if (a.error || b.error) throw new Error((a.error || b.error).message)

  return { photoPath, thumbPath }
}

// Best-effort cleanup after a successful delete_entry — never blocks or
// throws into the caller's UI flow over a storage hiccup.
export async function deleteEntryPhotos(paths) {
  const list = paths.filter(Boolean)
  if (!list.length) return
  try {
    await supabase.storage.from(BUCKET).remove(list)
  } catch {
    // the database row is already gone; a stray file left behind isn't worth surfacing an error for
  }
}
