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

export const SECTORS: SectorDef[] = [
  { sector: "bank", label: "은행", partDiv: "A", lrgDiv: "A", aliases: ["은행", "시중은행", "bank"] },
  { sector: "holding", label: "금융지주", partDiv: "Z", lrgDiv: "Z", aliases: ["지주", "금융지주", "holding"] },
  { sector: "insurance_life", label: "생명보험", partDiv: "D", lrgDiv: "D", aliases: ["생보", "생명보험", "life"] },
  { sector: "insurance_nonlife", label: "손해보험", partDiv: "E", lrgDiv: "E", aliases: ["손보", "손해보험", "nonlife"] },
  { sector: "securities", label: "금융투자", partDiv: "F", lrgDiv: "F", aliases: ["증권", "금투", "금융투자", "securities"] },
  { sector: "savings_bank", label: "저축은행", partDiv: "I", lrgDiv: "I", aliases: ["저축은행", "저축", "savings"] },
  { sector: "card", label: "여신전문", partDiv: "H", lrgDiv: "H", aliases: ["카드", "캐피탈", "여전", "card"] },
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
