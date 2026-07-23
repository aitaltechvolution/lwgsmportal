import { supabase } from "@/lib/supabase";

/**
 * Course material files live in the private "course-materials" bucket.
 * Nothing is ever served from a public URL — every view re-requests a
 * fresh, short-lived signed URL (60s) right before rendering, so a copied
 * link goes stale almost immediately and the file is never directly
 * linkable or guessable.
 */
const SIGNED_URL_TTL_SECONDS = 60;

/** Extracts the storage object path from a stored material `url`.
 *  Materials saved before this migration may already be a full public
 *  URL — in that case we fall back to using it as-is. New uploads should
 *  store just the storage path (see CourseMaterials.tsx upload code).
 */
export function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx !== -1) return decodeURIComponent(url.slice(idx + marker.length));
  const signedMarker = `/storage/v1/object/sign/${bucket}/`;
  const signedIdx = url.indexOf(signedMarker);
  if (signedIdx !== -1) {
    const rest = url.slice(signedIdx + signedMarker.length);
    return decodeURIComponent(rest.split("?")[0]);
  }
  // Already a bare path like "{course_id}/filename.pdf"
  if (!url.startsWith("http")) return url;
  return null;
}

export async function getSignedViewUrl(bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Convenience: resolve a stored material URL/path into a fresh signed URL. */
export async function resolveSecureUrl(bucket: string, storedUrl: string): Promise<string | null> {
  const path = extractStoragePath(storedUrl, bucket);
  if (!path) return null;
  return getSignedViewUrl(bucket, path);
}

/**
 * Materials can now store either a private-storage path (uploaded file) or
 * a real external URL (a "Link" material, or a video/file added via a
 * pasted link instead of an upload). Storage paths are always bare
 * "{course_id}/{filename}" strings and never start with http(s) — so this
 * check reliably tells the two apart without needing a separate DB column.
 * External links must be opened directly (window.open / <a>) and must
 * NEVER be passed to resolveSecureUrl, which only understands storage
 * paths and will fail to resolve a real external URL.
 */
export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
