// ─── 사용자 역할 ───
export const ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",       // 행정담당자
  COOK: "COOK",             // 급식담당자
  RESERVIST: "RESERVIST",   // 소집훈련 대상자
} as const;

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "관리자",
  MANAGER: "행정담당자",
  COOK: "급식담당자",
  RESERVIST: "훈련대상자",
};

// ─── 차수 상태 ───
export const BATCH_STATUS = {
  PLANNED: "PLANNED",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
} as const;

export const BATCH_STATUS_LABELS: Record<string, string> = {
  PLANNED: "계획",
  ACTIVE: "진행중",
  COMPLETED: "완료",
};

// ─── 출석 상태 ───
export const ATTENDANCE_STATUS = {
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
  PENDING: "PENDING",
} as const;

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: "참석",
  ABSENT: "불참",
  PENDING: "미정",
};

// ─── 훈련 유형 ───
export const TRAINING_TYPES = [
  "사격",
  "화생방",
  "전술",
  "체력",
  "정신교육",
  "기타",
] as const;

// ─── 식사 유형 ───
export const MEAL_TYPES = {
  BREAKFAST: "BREAKFAST",
  LUNCH: "LUNCH",
  DINNER: "DINNER",
} as const;

export const MEAL_TYPE_LABELS: Record<string, string> = {
  BREAKFAST: "조식",
  LUNCH: "중식",
  DINNER: "석식",
};

// ─── 훈련비 입금 프로세스 상태 ───
export const PAYMENT_STATUS = {
  DOC_DRAFT: "DOC_DRAFT",
  DOC_APPROVED: "DOC_APPROVED",
  CMS_DRAFT: "CMS_DRAFT",
  CMS_APPROVED: "CMS_APPROVED",
} as const;

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  DOC_DRAFT: "공문 상신",
  DOC_APPROVED: "공문 결재완료",
  CMS_DRAFT: "CMS 결재 상신",
  CMS_APPROVED: "결재완료 입금",
};

export const PAYMENT_STATUS_ORDER = [
  "DOC_DRAFT",
  "DOC_APPROVED",
  "CMS_DRAFT",
  "CMS_APPROVED",
] as const;

// ─── 알림 유형 ───
export const NOTIFICATION_TYPES = {
  GENERAL: "GENERAL",
  TRAINING: "TRAINING",
  PAYMENT: "PAYMENT",
  NOTICE: "NOTICE",
} as const;

// ─── 계급 ───
export const RANKS = [
  "이병",
  "일병",
  "상병",
  "병장",
  "하사",
  "중사",
  "상사",
  "원사",
  "준위",
  "소위",
  "중위",
  "대위",
  "소령",
  "중령",
  "대령",
] as const;
