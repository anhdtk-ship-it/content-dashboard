/**
 * Mapping HIỂN THỊ tên Biên tập (editor_name) → tên đầy đủ.
 * CHỈ dùng cho phần hiển thị UI — KHÔNG đổi dữ liệu DB/Supabase/API.
 * Giá trị lọc (filter value) vẫn dùng editor_name gốc; chỉ nhãn hiển thị đổi.
 * Editor không có trong mapping → giữ nguyên.
 */
const EDITOR_DISPLAY: Record<string, string> = {
  'đphương': 'Đoàn Phương',
  'ptnquynh': 'Như Quỳnh',
  'dnktuyen': 'Khánh Tuyền',
  'tbhan': 'Bảo Hân',
  'ngnqnhu': 'Quỳnh Như',
  'nvhoan': 'Hoàn',
  'tthphuc': 'Phúc',
  'tthuyen': 'Huyền',
};

/** Trả về tên Biên tập đầy đủ để hiển thị; nếu không có trong mapping thì giữ nguyên. */
export function editorLabel(raw?: string | null): string {
  const key = (raw ?? '').trim();
  return EDITOR_DISPLAY[key] ?? key;
}
