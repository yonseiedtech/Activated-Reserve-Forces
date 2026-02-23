/**
 * 전화번호 자동 포맷: 숫자만 추출 후 010-XXXX-XXXX 형태로 변환
 * 예: "01012345678" → "010-1234-5678"
 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/**
 * 군번 자동 포맷: 임관연도 2자리-나머지 숫자
 * 예: "1212345678" → "12-12345678"
 */
export function formatServiceNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

/**
 * 생년월일 6자리 → YYYY-MM-DD 변환
 * 예: "950315" → "1995-03-15", "030101" → "2003-01-01"
 * 이미 YYYY-MM-DD 형식이면 그대로 반환
 * 숫자만 입력 중이면 자동으로 하이픈 삽입
 */
export function formatBirthDate(value: string): string {
  // 이미 YYYY-MM-DD 형식이면 그대로
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const digits = value.replace(/\D/g, "");

  // 6자리 입력 완료 → YYYY-MM-DD로 변환
  if (digits.length === 6) {
    const yy = parseInt(digits.slice(0, 2), 10);
    const mm = digits.slice(2, 4);
    const dd = digits.slice(4, 6);
    // 00~29 → 2000년대, 30~99 → 1900년대
    const yyyy = yy <= 29 ? 2000 + yy : 1900 + yy;
    return `${yyyy}-${mm}-${dd}`;
  }

  // 8자리 (YYYYMMDD) → YYYY-MM-DD
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }

  // 입력 중: 숫자만 표시 (최대 8자리)
  return digits.slice(0, 8);
}
