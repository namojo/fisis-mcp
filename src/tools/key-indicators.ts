import { resolveCompany } from "../core/resolver.js";
import { fetchIndicators, defaultPresetsFor } from "../core/indicator-service.js";
import { findPreset } from "../domain/indicator-presets.js";
import { baseMonthToLabel, fmtNumber, mdTable, recentQuarterRange, SOURCE_LINE, trendArrow } from "../core/formatter.js";
import { SECTORS } from "../domain/sectors.js";

export async function keyIndicatorsTool(args: {
  company: string;
  indicators?: string[];
  periods?: number;
}): Promise<string> {
  const resolved = await resolveCompany(args.company);
  if (resolved.status !== "resolved" || !resolved.match) {
    const cands = resolved.candidates.map((c) => `- ${c.name} (${c.financeCd})`).join("\n");
    return `'${args.company}' 회사를 확정할 수 없습니다.\n후보:\n${cands}\n→ 정확한 회사명 또는 financeCd로 재호출하세요.`;
  }
  const company = resolved.match;
  const sectorLabel = SECTORS.find((s) => s.sector === company.sector)?.label ?? company.sector;

  // 지표 별칭 → 프리셋 키
  let presetKeys: string[];
  const unknown: string[] = [];
  if (args.indicators && args.indicators.length > 0) {
    presetKeys = [];
    for (const ind of args.indicators) {
      const p = findPreset(ind, company.sector);
      if (p) presetKeys.push(p.key);
      else unknown.push(ind);
    }
  } else {
    presetKeys = defaultPresetsFor(company.sector);
  }
  if (presetKeys.length === 0) {
    return [
      `⚠️ ${sectorLabel} 권역에서 매칭되는 프리셋 지표가 없습니다${unknown.length ? ` (미인식: ${unknown.join(", ")})` : ""}.`,
      `→ fisis_list_statistics sector='${company.sector}' keyword='...' 로 직접 탐색 후 fisis_get_statistics 를 사용하세요.`,
    ].join("\n");
  }

  const periods = args.periods ?? 4;
  const { start, end } = recentQuarterRange(periods);
  const results = await fetchIndicators(presetKeys, company.financeCd, start, end);

  // 시점 축 수집
  const allMonths = new Set<string>();
  for (const r of results) if ("points" in r) for (const m of r.points.keys()) allMonths.add(m);
  const months = [...allMonths].sort();

  if (months.length === 0) {
    const errs = results
      .map((r) => ("error" in r ? `- ${r.presetKey}: ${r.error}` : null))
      .filter(Boolean)
      .join("\n");
    return [
      `${company.name}의 지표 데이터를 가져오지 못했습니다 (조회기간 ${start}~${end}).`,
      errs,
      `→ 공표 시차 가능성: periods를 늘리거나 fisis_get_statistics 로 기간을 직접 지정해보세요.`,
    ].join("\n\n");
  }

  const headers = ["지표", ...months.map((m) => baseMonthToLabel(m, "Q")), "추세"];
  const rows: string[][] = [];
  const notes: string[] = [];
  const failures: string[] = [];

  for (const r of results) {
    if ("error" in r) {
      failures.push(`${r.presetKey}: ${r.error}`);
      continue;
    }
    const values = months.map((m) => r.points.get(m) ?? null);
    rows.push([
      `${r.preset.label}(${r.preset.unit})`,
      ...values.map((v) => fmtNumber(v, r.preset.unit)),
      trendArrow(values),
    ]);
    if (r.note) notes.push(r.note);
  }

  const parts = [`## ${company.name} 핵심 경영지표 — ${sectorLabel} (최근 ${months.length}개 분기)`, mdTable(headers, rows)];
  if (unknown.length) parts.push(`ℹ️ 미인식 지표: ${unknown.join(", ")} → fisis_list_statistics 로 탐색 가능`);
  if (failures.length) parts.push(`ℹ️ 조회 실패: ${failures.join(" / ")}`);
  if (notes.length) parts.push(`ℹ️ ${[...new Set(notes)].join(" / ")}`);
  parts.push(SOURCE_LINE);
  return parts.join("\n\n");
}
