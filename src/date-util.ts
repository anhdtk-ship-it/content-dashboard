/**
 * Parse chuỗi ngày dạng "dd/mm" (hoặc "d/m") -> "YYYY-MM-DD".
 * Năm mặc định 2026 theo nghiệp vụ (vd "07/03" -> "2026-03-07").
 * Trả về null nếu rỗng / sai định dạng / ngày không hợp lệ.
 */
export const ASSUMED_YEAR = 2026;

export function parseDdmmToReal(text?: string | null, year: number = ASSUMED_YEAR): string | null {
  const v = (text ?? '').toString().trim();
  if (!v) return null;
  const m = v.match(/^(\d{1,2})\s*\/\s*(\d{1,2})/); // chấp nhận "7/3", "07/03", "07/03/26"...
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return null;
  const iso = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  // Xác thực ngày thực (loại 31/02, 31/04...)
  const d = new Date(iso + 'T00:00:00Z');
  if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== mm || d.getUTCDate() !== dd) return null;
  return iso;
}
