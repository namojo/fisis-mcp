/**
 * FISIS 금융권역(partDiv / lrgDiv) 매핑.
 *
 * ⚠️ partDiv 코드는 FISIS OpenAPI 문서의 코드표 기준이며, 최초 실행 시
 * scripts/verify-presets.ts 로 실측 검증해야 한다. 검증 전 값은 잠정치.
 * (getMFdata 확인: companySearch 기본값 "A" = 전체)
 */
import type { Sector } from "../fisis/types.js";

export interface SectorDef {
  sector: Sector;
  label: string;
  /** companySearch partDiv (잠정 — verify-presets로 확정) */
  partDiv: string;
  /** statisticsListSearch lrgDiv (잠정) */
  lrgDiv: string;
  aliases: string[];
}

/**
 * 권역코드 — 2026-07-13 partDiv 전수 실측으로 확정 (companySearch A~T 조회):
 * A=국내은행(20사) C=전업카드(8사) E=저축은행(79사) F=금융투자(61사)
 * H=생명보험(22사) I=손해보험(32사) L=금융지주(10사)
 * 기타: B=?(134) D=종금(영업중 0) G=자산운용 J=외은지점 K/T=캐피탈 M=부동산신탁
 *       N=신기술금융 O=신협 P=수협 Q=단위농협 R=선물등 S=산림조합
 * partDiv(회사 API)와 lrgDiv(통계 API)는 동일 코드 공간 사용 (실측 확인).
 */
export const SECTORS: SectorDef[] = [
  { sector: "bank", label: "은행", partDiv: "A", lrgDiv: "A", aliases: ["은행", "시중은행", "bank"] },
  { sector: "holding", label: "금융지주", partDiv: "L", lrgDiv: "L", aliases: ["지주", "금융지주", "holding"] },
  { sector: "insurance_life", label: "생명보험", partDiv: "H", lrgDiv: "H", aliases: ["생보", "생명보험", "life"] },
  { sector: "insurance_nonlife", label: "손해보험", partDiv: "I", lrgDiv: "I", aliases: ["손보", "손해보험", "nonlife"] },
  { sector: "securities", label: "금융투자", partDiv: "F", lrgDiv: "F", aliases: ["증권", "금투", "금융투자", "securities"] },
  { sector: "savings_bank", label: "저축은행", partDiv: "E", lrgDiv: "E", aliases: ["저축은행", "저축", "savings"] },
  { sector: "card", label: "여신전문(카드)", partDiv: "C", lrgDiv: "C", aliases: ["카드", "여전", "card"] },
];

export function resolveSector(input: string): SectorDef | null {
  const q = input.trim().toLowerCase();
  return (
    SECTORS.find((s) => s.sector === q) ??
    SECTORS.find((s) => s.label === input.trim()) ??
    SECTORS.find((s) => s.aliases.some((a) => a.toLowerCase() === q)) ??
    null
  );
}
