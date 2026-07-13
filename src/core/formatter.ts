/**
 * 응답 정규화 포매터.
 * 원칙: 모든 테이블에 단위·출처 명기, 결측은 "-", 숫자는 읽기 좋게.
 */

export const SOURCE_LINE = "출처: 금융감독원 금융통계정보시스템(FISIS)";

export function fmtNumber(v: unknown, unit?: string): string {
  if (v === null || v === undefined || v === "") return "-";
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  if (Number.isNaN(n)) return String(v);
  if (unit === "%") return n.toFixed(2);
  // 원 단위 금액은 조/억으로 humanize (실측: FISIS 금액 통계는 원 단위) — 가독성 + 토큰 절약
  if (unit === "원") {
    const abs = Math.abs(n);
    if (abs >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
    if (abs >= 1e8) return `${Math.round(n / 1e8).toLocaleString("ko-KR")}억`;
  }
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

export function mdTable(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `|${headers.map(() => "---").join("|")}|`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}

/** YYYYMM → "2026Q1" 표기 */
export function baseMonthToLabel(baseMm: string, term: string): string {
  const y = baseMm.slice(0, 4);
  const m = Number(baseMm.slice(4, 6));
  if (term === "Y") return y;
  if (term === "H") return `${y}H${m <= 6 ? 1 : 2}`;
  return `${y}Q${Math.ceil(m / 3)}`;
}

/** 단순 추세 화살표 (마지막 두 값 비교) */
export function trendArrow(values: (number | null)[]): string {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return "";
  const [prev, last] = [nums[nums.length - 2], nums[nums.length - 1]];
  if (last > prev) return "↗";
  if (last < prev) return "↘";
  return "→";
}

export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 최근 N개 분기의 (startBaseMm, endBaseMm) 계산 — 공표 시차 3개월 가정 */
export function recentQuarterRange(periods: number): { start: string; end: string } {
  const now = new Date();
  // 공표 시차: 현재월 - 3개월이 속한 분기말을 최신 후보로
  const probe = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const qEndMonth = Math.ceil((probe.getMonth() + 1) / 3) * 3;
  const end = new Date(probe.getFullYear(), qEndMonth - 1, 1);
  const start = new Date(end.getFullYear(), end.getMonth() - 3 * (periods - 1), 1);
  const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}
