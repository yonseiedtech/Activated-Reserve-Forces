// 훈련 보상비 계산 로직
// 8시간 기준: 평일 100,000원, 주말 150,000원
// 점심시간(1h) 제외, 시간 비례 계산

const WEEKDAY_RATE = 100_000; // 평일 8시간 기준
const WEEKEND_RATE = 150_000; // 주말 8시간 기준
const BASE_HOURS = 8;

// 점심시간 구간 (일반: 11:30~12:30)
const LUNCH_START = 11.5; // 11:30
const LUNCH_END = 12.5;   // 12:30

function timeToHours(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h + m / 60;
}

/**
 * 실훈련 시간 계산 (점심시간 제외)
 */
export function calcTrainingHours(startTime: string, endTime: string): number {
  const start = timeToHours(startTime);
  const end = timeToHours(endTime);

  let totalHours = end - start;
  if (totalHours <= 0) return 0;

  // 점심시간 겹침 계산 (11:30~12:30)
  const overlapStart = Math.max(start, LUNCH_START);
  const overlapEnd = Math.min(end, LUNCH_END);
  if (overlapStart < overlapEnd) {
    totalHours -= (overlapEnd - overlapStart);
  }

  return Math.max(0, Math.round(totalHours * 100) / 100);
}

/**
 * 주말 여부 판별 (토:6, 일:0)
 */
export function isWeekendDay(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * 보상비 계산
 */
export function calcDailyRate(trainingHours: number, isWeekend: boolean): number {
  const baseRate = isWeekend ? WEEKEND_RATE : WEEKDAY_RATE;
  const rate = (trainingHours / BASE_HOURS) * baseRate;
  // 100원 단위 반올림
  return Math.round(rate / 100) * 100;
}

/**
 * 훈련 정보로부터 보상비 정보 일괄 계산
 */
export function calcCompensation(training: {
  date: Date | string;
  startTime: string | null;
  endTime: string | null;
}): {
  trainingHours: number;
  isWeekend: boolean;
  dailyRate: number;
} {
  const date = typeof training.date === "string" ? new Date(training.date) : training.date;
  const isWeekend = isWeekendDay(date);

  if (!training.startTime || !training.endTime) {
    return { trainingHours: 0, isWeekend, dailyRate: 0 };
  }

  const trainingHours = calcTrainingHours(training.startTime, training.endTime);
  const dailyRate = calcDailyRate(trainingHours, isWeekend);

  return { trainingHours, isWeekend, dailyRate };
}
