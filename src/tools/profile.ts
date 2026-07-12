import { resolveCompany } from "../core/resolver.js";
import { keyIndicatorsTool } from "./key-indicators.js";
import { comparePeersTool } from "./compare-peers.js";
import { defaultGroupForSector } from "../domain/peer-groups.js";
import { DEFAULT_SETS, PRESETS } from "../domain/indicator-presets.js";
import { SECTORS } from "../domain/sectors.js";

/** focus → 벤치마킹할 지표 우선순위 */
const FOCUS_MAP: Record<string, string[]> = {
  건전성: ["bis_ratio", "npl_ratio", "kics_life", "kics_nonlife", "bis_savings", "ncr", "adj_capital_card"],
  수익성: ["roa_bank", "roe_bank", "loss_ratio", "net_income_bank"],
  성장성: ["total_assets_bank", "premium_income_life"],
};

export async function profileTool(args: { company: string; focus?: string }): Promise<string> {
  const resolved = await resolveCompany(args.company);
  if (resolved.status !== "resolved" || !resolved.match) {
    const cands = resolved.candidates.map((c) => `- ${c.name} (${c.financeCd})`).join("\n");
    return `'${args.company}' 회사를 확정할 수 없습니다.\n후보:\n${cands}`;
  }
  const company = resolved.match;
  const sectorLabel = SECTORS.find((s) => s.sector === company.sector)?.label ?? company.sector;

  // ① 핵심지표 4분기
  const indicatorsSection = await keyIndicatorsTool({ company: company.financeCd, periods: 4 });

  // ② 벤치마킹: focus 기준 상위 2개 지표 (권역 프리셋과 교집합)
  const sectorKeys = new Set(DEFAULT_SETS[company.sector] ?? []);
  const focusKeys = args.focus && FOCUS_MAP[args.focus] ? FOCUS_MAP[args.focus] : FOCUS_MAP["건전성"];
  const benchKeys = focusKeys.filter((k) => sectorKeys.has(k)).slice(0, 2);
  // focus 교집합이 없으면 권역 기본 첫 2개
  const finalBench = benchKeys.length > 0 ? benchKeys : [...sectorKeys].slice(0, 2);

  const benchSections: string[] = [];
  const group = defaultGroupForSector(company.sector);
  if (group) {
    for (const key of finalBench) {
      const preset = PRESETS.find((p) => p.key === key);
      if (!preset) continue;
      try {
        benchSections.push(await comparePeersTool({ company: company.financeCd, indicator: preset.label }));
      } catch {
        benchSections.push(`ℹ️ ${preset.label} 벤치마킹 실패 — fisis_compare_peers 로 개별 재시도 가능`);
      }
    }
  } else {
    benchSections.push(`ℹ️ ${sectorLabel} 권역은 기본 동종그룹이 정의되지 않아 벤치마킹을 생략합니다.`);
  }

  return [
    `# ${company.name} 종합 프로파일`,
    `- 권역: ${sectorLabel} / financeCd: ${company.financeCd}${args.focus ? ` / 강조 관점: ${args.focus}` : ""}`,
    `---`,
    indicatorsSection,
    `---`,
    ...benchSections,
    `---`,
    `ℹ️ 데이터 공백이 있는 항목은 각 섹션에 명시됨. 특정 지표 심화는 fisis_key_indicators, 특수 지표는 fisis_list_statistics 사용.`,
  ].join("\n\n");
}
