/**
 * ★ 업권별 핵심지표 프리셋 — 2026-07-13 FISIS 실API 검증 완료.
 *
 * 검증 방법: scripts/verify-presets.ts + 계정 레벨 수동 실측.
 * 재검증: 분기 1회 `npm run verify-presets` 권장 (통계표 개편 감지).
 *
 * 실측에서 확인된 도메인 지식 (코드에 반영됨):
 * - 지급여력비율(SH021/SI021)은 "경과조치 적용 전"(A)을 기본으로 사용.
 *   경과조치 미신청사는 "적용 후"(D) 계정이 0으로 수록되므로 벤치마킹 시
 *   적용 전 기준이 공정 비교. (실측: 삼성생명 A=193~198%, D=0)
 * - SH021/SI021은 연속 시계열: '23.3 이후 K-ICS, 이전은 RBC가 같은 계정에 수록.
 *   (실측: 삼성생명 2021~2022 = 332%→244%, 공시 RBC와 일치) → 폴백 프리셋 불필요.
 * - 은행 예대율은 FISIS OpenAPI 미제공 (SA018 유동성은 LCR/NSFR 체제) → 연체율로 대체.
 * - 손보 경과손해율(SI136)은 "(22.12월 이전)" 동결 표이고 계정 목록이 비어 있음
 *   (IFRS17 전환) → 손해율 프리셋 제공하지 않음. 필요 시 fisis_list_statistics로 탐색.
 * - 생보 보험료수입(SH166)은 일반/특별계정 분리 수록으로 단일 총계 계정 부재 → 프리셋 제외.
 */
import type { Sector } from "../fisis/types.js";

export interface IndicatorPreset {
  key: string;
  label: string;
  aliases: string[];
  sector: Sector;
  listNo: string | null;
  accountCd: string | null;
  /** 미검증 프리셋의 동적 탐색 + verify 스크립트 공용 키워드 */
  searchHints: { list: string[]; account: string[] };
  direction: "higher_better" | "lower_better";
  unit: string;
  verified: boolean;
  /** 통계 주기 오버라이드 — 실측: 유지율(SH025)은 반기(H) 전용, 기본은 분기(Q) */
  term?: "Y" | "H" | "Q";
}

export const PRESETS: IndicatorPreset[] = [
  // ── 은행 (partDiv/lrgDiv = A) ─────────────────────────
  {
    key: "bis_ratio", label: "BIS자기자본비율", sector: "bank",
    aliases: ["BIS비율", "BIS", "자기자본비율", "총자본비율", "건전성비율"],
    listNo: "SA014", accountCd: "A", // 자본적정성 / BIS기준 자기자본비율
    searchHints: { list: ["자본적정성"], account: ["BIS기준"] },
    direction: "higher_better", unit: "%", verified: true,
  },
  {
    key: "npl_ratio", label: "고정이하여신비율", sector: "bank",
    aliases: ["NPL비율", "NPL", "부실채권비율", "고정이하"],
    listNo: "SA015", accountCd: "C", // 여신건전성 / 고정이하여신비율
    searchHints: { list: ["여신건전성"], account: ["고정이하여신비율"] },
    direction: "lower_better", unit: "%", verified: true,
  },
  {
    key: "roa_bank", label: "ROA", sector: "bank",
    aliases: ["총자산이익률", "총자산순이익률", "roa"],
    listNo: "SA017", accountCd: "A6", // 수익성 / 총자산순이익률(ROA)
    searchHints: { list: ["수익성"], account: ["ROA"] },
    direction: "higher_better", unit: "%", verified: true,
  },
  {
    key: "roe_bank", label: "ROE", sector: "bank",
    aliases: ["자기자본이익률", "자기자본순이익률", "roe"],
    listNo: "SA017", accountCd: "A7", // 수익성 / 자기자본순이익률(ROE)
    searchHints: { list: ["수익성"], account: ["ROE"] },
    direction: "higher_better", unit: "%", verified: true,
  },
  {
    key: "delinquency_bank", label: "연체율(총대출)", sector: "bank",
    aliases: ["연체율", "연체", "예대율" /* 예대율 미제공 — 가장 근접한 건전성 지표로 안내 */],
    listNo: "SA040", accountCd: "A3", // 연체율(원화대출금...) / 총대출채권_연체율
    searchHints: { list: ["연체율"], account: ["연체율"] },
    direction: "lower_better", unit: "%", verified: true,
  },
  {
    key: "total_assets_bank", label: "총자산", sector: "bank",
    aliases: ["자산", "자산규모", "총자산", "자산총계"],
    listNo: "SA003", accountCd: "A", // 요약재무상태표(자산-은행계정) / 자산총계
    searchHints: { list: ["요약재무상태표"], account: ["자산총계"] },
    direction: "higher_better", unit: "원", verified: true, // 실측: 금액 통계는 원 단위 (unit_nm 미제공)
  },
  {
    key: "net_income_bank", label: "당기순이익", sector: "bank",
    aliases: ["순이익", "당기순이익"],
    listNo: "SA021", accountCd: "K", // 요약손익계산서(은행계정) / 당기순이익
    searchHints: { list: ["요약손익계산서"], account: ["당기순이익"] },
    direction: "higher_better", unit: "원", verified: true, // 실측: 금액 통계는 원 단위 (unit_nm 미제공)
  },
  // ── 생명보험 (H) ──────────────────────────────────────
  {
    key: "kics_life", label: "지급여력비율(K-ICS)", sector: "insurance_life",
    aliases: ["K-ICS", "킥스", "지급여력비율", "kics", "RBC", "지급여력"],
    listNo: "SH021", accountCd: "A", // 자본적정성 / 지급여력비율(경과조치 적용 전)
    // 연속 시계열: '23.3 이후 K-ICS, 이전 RBC. 경과조치 "적용 후"(D)는 미신청사 0.
    searchHints: { list: ["자본적정성"], account: ["지급여력비율(경과조치 적용 전)"] },
    direction: "higher_better", unit: "%", verified: true,
  },
  {
    key: "roa_life", label: "ROA", sector: "insurance_life",
    aliases: ["총자산이익률", "총자산순이익률", "roa"],
    listNo: "SH114", accountCd: "H", // 경영효율지표 / 총자산순이익률
    searchHints: { list: ["경영효율지표"], account: ["총자산순이익률"] },
    direction: "higher_better", unit: "%", verified: true,
  },
  {
    key: "persistency_13", label: "13회차 계약유지율", sector: "insurance_life",
    aliases: ["유지율", "계약유지율", "13회차유지율", "13회차"],
    listNo: "SH025", accountCd: "A", // 보험계약 유지율(13회, 25회) / 13회차 계약유지율
    searchHints: { list: ["유지율"], account: ["13회차"] },
    direction: "higher_better", unit: "%", verified: true, term: "H", // 실측: 반기 전용
  },
  {
    key: "persistency_25", label: "25회차 계약유지율", sector: "insurance_life",
    aliases: ["25회차유지율", "25회차"],
    listNo: "SH025", accountCd: "B",
    searchHints: { list: ["유지율"], account: ["25회차"] },
    direction: "higher_better", unit: "%", verified: true, term: "H", // 실측: 반기 전용
  },
  // ── 손해보험 (I) ──────────────────────────────────────
  {
    key: "kics_nonlife", label: "지급여력비율(K-ICS)", sector: "insurance_nonlife",
    aliases: ["K-ICS", "킥스", "지급여력비율", "RBC", "지급여력"],
    listNo: "SI021", accountCd: "A",
    searchHints: { list: ["자본적정성"], account: ["지급여력비율(경과조치 적용 전)"] },
    direction: "higher_better", unit: "%", verified: true,
  },
  {
    key: "roa_nonlife", label: "ROA", sector: "insurance_nonlife",
    aliases: ["총자산이익률", "총자산순이익률", "roa"],
    listNo: "SI114", accountCd: "H", // 경영효율지표 / 총자산순이익률
    searchHints: { list: ["경영효율지표"], account: ["총자산순이익률"] },
    direction: "higher_better", unit: "%", verified: true,
  },
  // ── 금융투자 (F) ──────────────────────────────────────
  {
    key: "ncr", label: "순자본비율(NCR)", sector: "securities",
    aliases: ["NCR", "순자본비율"],
    listNo: "SF308", accountCd: "E", // 자본적정성(개별기준 순자본비율('15.03 이후)) / 순자본비율
    // 주의: SF008/SF208은 구제도(영업용순자본비율) 동결 표 — 매칭 금지
    searchHints: { list: ["개별기준 순자본비율"], account: ["순자본비율"] },
    direction: "higher_better", unit: "%", verified: true,
  },
  {
    key: "leverage_sec", label: "레버리지비율", sector: "securities",
    aliases: ["레버리지", "레버리지비율"],
    listNo: "SF331", accountCd: "C", // 자본적정성(레버리지 비율) / 레버리지비율
    searchHints: { list: ["레버리지"], account: ["레버리지비율"] },
    direction: "lower_better", unit: "%", verified: true,
  },
  // ── 저축은행 (E) ──────────────────────────────────────
  {
    key: "bis_savings", label: "BIS비율", sector: "savings_bank",
    aliases: ["BIS", "BIS비율", "자기자본비율"],
    listNo: "SE035", accountCd: "C", // BIS기준 자기자본 비율 / BIS비율
    searchHints: { list: ["BIS기준"], account: ["BIS비율"] },
    direction: "higher_better", unit: "%", verified: true,
  },
  {
    key: "npl_savings", label: "고정이하여신비율", sector: "savings_bank",
    aliases: ["NPL", "고정이하", "부실채권", "고정이하여신비율"],
    listNo: "SE008", accountCd: "A4", // 여신건전성 / 고정이하여신비율
    searchHints: { list: ["여신건전성"], account: ["고정이하여신비율"] },
    direction: "lower_better", unit: "%", verified: true,
  },
  // ── 여신전문/카드 (C) ─────────────────────────────────
  {
    key: "adj_capital_card", label: "조정자기자본비율", sector: "card",
    aliases: ["조정자기자본", "자본비율", "조정자기자본비율"],
    listNo: "SC127", accountCd: "A", // 조정자기자본비율 / 조정자기자본비율
    searchHints: { list: ["조정자기자본비율"], account: ["조정자기자본비율"] },
    direction: "higher_better", unit: "%", verified: true,
  },
  {
    key: "delinquency_card", label: "연체채권비율(1개월 이상)", sector: "card",
    aliases: ["연체율", "연체", "연체채권비율"],
    listNo: "SC117", accountCd: "B", // 여신건전성(연체채권비율) / 연체채권비율(1개월 이상)
    searchHints: { list: ["연체채권비율"], account: ["연체채권비율"] },
    direction: "lower_better", unit: "%", verified: true,
  },
];

/** 권역 기본 지표 세트 (fisis_key_indicators에서 indicators 미지정 시) */
export const DEFAULT_SETS: Record<Sector, string[]> = {
  bank: ["bis_ratio", "npl_ratio", "roa_bank", "roe_bank", "delinquency_bank", "total_assets_bank", "net_income_bank"],
  insurance_life: ["kics_life", "roa_life", "persistency_13", "persistency_25"],
  insurance_nonlife: ["kics_nonlife", "roa_nonlife"],
  securities: ["ncr", "leverage_sec"],
  savings_bank: ["bis_savings", "npl_savings"],
  card: ["adj_capital_card", "delinquency_card"],
  holding: [],
};

export function findPreset(query: string, sector?: Sector): IndicatorPreset | null {
  const q = query.trim().toLowerCase();
  const pool = sector ? PRESETS.filter((p) => p.sector === sector) : PRESETS;
  return (
    pool.find((p) => p.key === q) ??
    pool.find((p) => p.label.toLowerCase() === q) ??
    pool.find((p) => p.aliases.some((a) => a.toLowerCase() === q)) ??
    pool.find((p) => p.aliases.some((a) => q.includes(a.toLowerCase()) || a.toLowerCase().includes(q))) ??
    null
  );
}
