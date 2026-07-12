/**
 * ★ 이 프로젝트의 핵심 도메인 자산: 업권별 핵심지표 프리셋.
 *
 * "제안서에서 실제로 인용되는 지표"를 자연어 별칭 → FISIS 코드(listNo/accountCd)로 매핑한다.
 *
 * ══════════════════════════════════════════════════════════════
 * CRITICAL — 코드 확정 워크플로우:
 *   1. npm run build && npm run verify-presets   (API 키 필요, 한국 IP)
 *   2. 스크립트가 statisticsListSearch + accountListSearch 실측 결과에서
 *      searchHints 키워드로 후보 코드를 출력
 *   3. 출력을 보고 아래 listNo/accountCd 를 채운 뒤 verified: true 로 변경
 *
 * listNo/accountCd가 null인 프리셋은 런타임에 searchHints 기반 동적 탐색을
 * 시도한다 (느리지만 동작). verified 프리셋은 즉시 조회한다.
 * ══════════════════════════════════════════════════════════════
 */
import type { Sector } from "../fisis/types.js";

export interface IndicatorPreset {
  key: string;
  label: string;
  aliases: string[];
  sector: Sector;
  listNo: string | null;
  accountCd: string | null;
  /** 통계표명/계정명에서 이 지표를 찾기 위한 키워드 (동적 탐색 + verify 스크립트 공용) */
  searchHints: { list: string[]; account: string[] };
  direction: "higher_better" | "lower_better";
  unit: string;
  verified: boolean;
  /** 기간 분기 로직용 (예: K-ICS는 2023~, 이전은 RBC) */
  availableFrom?: string; // YYYYMM
  fallbackKey?: string;
}

export const PRESETS: IndicatorPreset[] = [
  // ── 은행 ──────────────────────────────────────────────
  {
    key: "bis_ratio", label: "BIS총자본비율", sector: "bank",
    aliases: ["BIS비율", "BIS", "자기자본비율", "총자본비율", "건전성비율"],
    listNo: null, accountCd: null,
    searchHints: { list: ["자본적정성", "BIS"], account: ["총자본비율", "BIS기준"] },
    direction: "higher_better", unit: "%", verified: false,
  },
  {
    key: "npl_ratio", label: "고정이하여신비율", sector: "bank",
    aliases: ["NPL비율", "NPL", "부실채권비율", "고정이하"],
    listNo: null, accountCd: null,
    searchHints: { list: ["자산건전성", "여신"], account: ["고정이하여신비율"] },
    direction: "lower_better", unit: "%", verified: false,
  },
  {
    key: "roa_bank", label: "ROA", sector: "bank",
    aliases: ["총자산이익률", "roa"],
    listNo: null, accountCd: null,
    searchHints: { list: ["수익성", "경영지표"], account: ["총자산순이익률", "ROA"] },
    direction: "higher_better", unit: "%", verified: false,
  },
  {
    key: "roe_bank", label: "ROE", sector: "bank",
    aliases: ["자기자본이익률", "roe"],
    listNo: null, accountCd: null,
    searchHints: { list: ["수익성", "경영지표"], account: ["자기자본순이익률", "ROE"] },
    direction: "higher_better", unit: "%", verified: false,
  },
  {
    key: "ldr", label: "예대율", sector: "bank",
    aliases: ["예대율", "예수금대비대출금"],
    listNo: null, accountCd: null,
    searchHints: { list: ["유동성", "예대"], account: ["예대율", "원화예대율"] },
    direction: "lower_better", unit: "%", verified: false,
  },
  {
    key: "total_assets_bank", label: "총자산", sector: "bank",
    aliases: ["자산", "자산규모", "총자산"],
    listNo: null, accountCd: null,
    searchHints: { list: ["재무상태표", "요약재무"], account: ["자산총계", "총자산"] },
    direction: "higher_better", unit: "백만원", verified: false,
  },
  {
    key: "net_income_bank", label: "당기순이익", sector: "bank",
    aliases: ["순이익", "당기순이익"],
    listNo: null, accountCd: null,
    searchHints: { list: ["손익계산서", "요약손익"], account: ["당기순이익"] },
    direction: "higher_better", unit: "백만원", verified: false,
  },
  // ── 생명보험 ──────────────────────────────────────────
  {
    key: "kics_life", label: "K-ICS비율", sector: "insurance_life",
    aliases: ["K-ICS", "킥스", "지급여력비율", "kics"],
    listNo: null, accountCd: null,
    searchHints: { list: ["지급여력", "K-ICS"], account: ["지급여력비율", "K-ICS비율"] },
    direction: "higher_better", unit: "%", verified: false,
    availableFrom: "202303", fallbackKey: "rbc_life",
  },
  {
    key: "rbc_life", label: "RBC비율", sector: "insurance_life",
    aliases: ["RBC", "알비씨"],
    listNo: null, accountCd: null,
    searchHints: { list: ["지급여력", "RBC"], account: ["RBC비율", "지급여력비율"] },
    direction: "higher_better", unit: "%", verified: false,
  },
  {
    key: "premium_income_life", label: "수입보험료", sector: "insurance_life",
    aliases: ["수입보험료", "보험료수입"],
    listNo: null, accountCd: null,
    searchHints: { list: ["보험료", "영업활동"], account: ["수입보험료"] },
    direction: "higher_better", unit: "백만원", verified: false,
  },
  {
    key: "persistency_13", label: "보험계약유지율(13회차)", sector: "insurance_life",
    aliases: ["유지율", "계약유지율", "13회차유지율"],
    listNo: null, accountCd: null,
    searchHints: { list: ["유지율", "계약"], account: ["13회차"] },
    direction: "higher_better", unit: "%", verified: false,
  },
  // ── 손해보험 ──────────────────────────────────────────
  {
    key: "kics_nonlife", label: "K-ICS비율", sector: "insurance_nonlife",
    aliases: ["K-ICS", "킥스", "지급여력비율"],
    listNo: null, accountCd: null,
    searchHints: { list: ["지급여력", "K-ICS"], account: ["지급여력비율", "K-ICS비율"] },
    direction: "higher_better", unit: "%", verified: false,
    availableFrom: "202303",
  },
  {
    key: "loss_ratio", label: "손해율", sector: "insurance_nonlife",
    aliases: ["손해율"],
    listNo: null, accountCd: null,
    searchHints: { list: ["손해율", "경영지표"], account: ["손해율"] },
    direction: "lower_better", unit: "%", verified: false,
  },
  // ── 금융투자 ──────────────────────────────────────────
  {
    key: "ncr", label: "순자본비율(NCR)", sector: "securities",
    aliases: ["NCR", "순자본비율"],
    listNo: null, accountCd: null,
    searchHints: { list: ["자본적정성", "순자본"], account: ["순자본비율", "NCR"] },
    direction: "higher_better", unit: "%", verified: false,
  },
  {
    key: "leverage_sec", label: "레버리지비율", sector: "securities",
    aliases: ["레버리지", "레버리지비율"],
    listNo: null, accountCd: null,
    searchHints: { list: ["레버리지", "경영지표"], account: ["레버리지비율"] },
    direction: "lower_better", unit: "%", verified: false,
  },
  // ── 저축은행 ──────────────────────────────────────────
  {
    key: "bis_savings", label: "BIS비율", sector: "savings_bank",
    aliases: ["BIS", "BIS비율", "자기자본비율"],
    listNo: null, accountCd: null,
    searchHints: { list: ["자본적정성", "BIS"], account: ["BIS기준", "자기자본비율"] },
    direction: "higher_better", unit: "%", verified: false,
  },
  {
    key: "npl_savings", label: "고정이하여신비율", sector: "savings_bank",
    aliases: ["NPL", "고정이하", "부실채권"],
    listNo: null, accountCd: null,
    searchHints: { list: ["자산건전성"], account: ["고정이하여신비율"] },
    direction: "lower_better", unit: "%", verified: false,
  },
  // ── 여신전문(카드) ────────────────────────────────────
  {
    key: "adj_capital_card", label: "조정자기자본비율", sector: "card",
    aliases: ["조정자기자본", "자본비율"],
    listNo: null, accountCd: null,
    searchHints: { list: ["자본적정성"], account: ["조정자기자본비율"] },
    direction: "higher_better", unit: "%", verified: false,
  },
  {
    key: "delinquency_card", label: "연체율", sector: "card",
    aliases: ["연체율", "연체"],
    listNo: null, accountCd: null,
    searchHints: { list: ["연체", "자산건전성"], account: ["연체율"] },
    direction: "lower_better", unit: "%", verified: false,
  },
];

/** 권역 기본 지표 세트 (fisis_key_indicators에서 indicators 미지정 시) */
export const DEFAULT_SETS: Record<Sector, string[]> = {
  bank: ["bis_ratio", "npl_ratio", "roa_bank", "roe_bank", "ldr", "total_assets_bank", "net_income_bank"],
  insurance_life: ["kics_life", "roa_bank", "premium_income_life", "persistency_13"],
  insurance_nonlife: ["kics_nonlife", "loss_ratio"],
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
