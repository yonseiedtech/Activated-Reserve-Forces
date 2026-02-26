/**
 * 날짜 문자열을 UTC Date로 변환 (시간대 이중 변환 방지)
 *
 * HTML input[type="date"]는 "YYYY-MM-DD" 형식을 반환하고,
 * new Date("YYYY-MM-DD")는 UTC 자정으로 해석되어
 * KST(+9)에서 9시간 오차가 발생할 수 있다.
 *
 * 이 함수는 입력 문자열에 명시적으로 T00:00:00.000Z를 붙여
 * 항상 UTC 자정으로 일관되게 저장한다.
 */
export function parseDate(dateString: string): Date {
  if (!dateString) return new Date(dateString);

  // 이미 ISO 형식(T 포함)이면 Z 접미사만 보장
  if (dateString.includes("T")) {
    if (dateString.endsWith("Z") || dateString.includes("+")) {
      return new Date(dateString);
    }
    return new Date(dateString + "Z");
  }

  // "YYYY-MM-DD" → UTC 자정
  return new Date(dateString + "T00:00:00.000Z");
}
