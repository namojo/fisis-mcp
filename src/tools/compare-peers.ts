import { resolveCompany } from "../core/resolver.js";
import { fetchIndicator } from "../core/indicator-service.js";
import { findPreset } from "../domain/indicator-presets.js";
import { defaultGroupForSector, resolvePeerGroup, PEER_GROUPS } from "../domain/peer-groups.js";
import { baseMonthToLabel, fmtNumber, mdTable, mean, median, recentQuarterRange, SOURCE_LINE } from "../core/formatter.js";

export async function comparePeersTool(args: {
  company: string;
  indicator: string;
  peerGroup?: string;
  baseMm?: string;
}): Promise<string> {
  const resolved = await resolveCompany(args.company);
  if (resolved.status !== "resolved" || !resolved.match) {
    return `'${args.company}' 회사를 확정할 수 없습니다. fisis_search_company 로 먼저 확인하세요.`;
  }
  const company = resolved.match;

  const preset = findPreset(args.indicator, company.sector);
  if (!preset) {
    return [
      `⚠️ '${args.indicator}' 지표가 ${company.sector} 권역 프리셋에 없습니다.`,
      `→ fisis_list_statistics sector='${company.sector}' keyword='${args.indicator}' 로 코드를 찾아 fisis_get_statistics 로 회사별 조회 후 직접 비교하세요.`,
    ].join("\n"); 
  }

  const group = args.peerGroup ? resolvePeerGroup(args.peerGroup) : defaultGroupForSector(company.sector);
  if (!group) {
    return `⚠️ 동종그룹을 결정할 수 없습니다.\n→ 사용 가능 그룹: ${PEER_GROUPS.map((g) => `${g.key}(${g.name})`).join(", ")}`;
  }

  // 기준월: 지정 없으면 최신 공표 분기 (탐침: 최근 3개 분기 범위 조회 후 최신값 사용)
  const range = args.baseMm
    ? { start: args.baseMm, end: args.baseMm }
    : recentQuarterRange(3);

  // 그룹 멤버 + 기준회사 조회 (기준회사가 그룹에 없을 수 있음)
  const memberSet = new Map<string, string>(); // financeCd -> name
  for (const name of group.memberNames) {
    const r = await resolveCompany(name, group.sector);
    if (r.status === "resolved" && r.match) memberSet.set(r.match.financeCd, r.match.name);
  }
  memberSet.set(company.financeCd, company.name);

  const entries: Array<{ financeCd: string; name: string; value: number; baseMm: string }> = [];
  const missing: string[] = [];
  const cds = [...memberSet.entries()];
  const CONCURRENCY = 5;
  for (let i = 0; i < cds.length; i += CONCURRENCY) {
    const batch = cds.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(([cd]) => fetchIndicator(preset.key, cd, range.start, range.end)),
    );
    settled.forEach((s, idx) => {
      const [cd, name] = batch[idx];
      if (s.status === "fulfilled") {
        // 최신 시점 값 채택
        const sorted = [...s.value.points.entries()].filter(([, v]) => v !== null).sort();
        if (sorted.length > 0) {
          const [bm, v] = sorted[sorted.length - 1];
          entries.push({ financeCd: cd, name, value: v as number, baseMm: bm });
        } else missing.push(name);
      } else missing.push(name);
    });
  }

  if (entries.length === 0) {
    return `그룹 '${group.name}'의 ${preset.label} 데이터를 가져오지 못했습니다. 기준월(${range.start}~${range.end})을 조정해 재시도하세요.`;
  }

  // 기준월 정합: 가장 흔한 baseMm으로 필터 (시점 섞임 방지)
  const modeBm = [...entries.reduce((m, e) => m.set(e.baseMm, (m.get(e.baseMm) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1])[0][0];
  const aligned = entries.filter((e) => e.baseMm === modeBm);
  const dropped = entries.filter((e) => e.baseMm !== modeBm).map((e) => e.name);

  const asc = preset.direction === "lower_better";
  aligned.sort((a, b) => (asc ? a.value - b.value : b.value - a.value));

  const target = aligned.find((e) => e.financeCd === company.financeCd);
  const values = aligned.map((e) => e.value);
  const avg = mean(values);
  const med = median(values);

  const rankLine = target
    ? `기준회사: **${company.name} ${fmtNumber(target.value, preset.unit)}${preset.unit}** — 그룹 내 ${aligned.indexOf(target) + 1}위/${aligned.length}사, 평균 대비 ${(target.value - avg >= 0 ? "+" : "")}${fmtNumber(target.value - avg, "%")}${preset.unit === "%" ? "%p" : preset.unit}`
    : `⚠️ 기준회사(${company.name})의 해당 시점 데이터가 없어 그룹 통계만 표시합니다.`;

  const parts = [
    `## ${preset.label} 벤치마킹 (${baseMonthToLabel(modeBm, "Q")}, ${group.name})`,
    rankLine,
    mdTable(
      ["순위", "회사", `값(${preset.unit})`],
      aligned.map((e, i) => [String(i + 1), e.financeCd === company.financeCd ? `**${e.name}**` : e.name, fmtNumber(e.value, preset.unit)]),
    ),
    `그룹 평균: ${fmtNumber(avg, preset.unit)}${preset.unit} / 중앙값: ${fmtNumber(med, preset.unit)}${preset.unit}`,
    `ℹ️ 단순평균 기준(자산가중 아님) — FISIS 웹의 가중평균과 다를 수 있습니다. ${preset.direction === "lower_better" ? "낮을수록 상위 정렬." : ""}`,
  ];
  if (missing.length || dropped.length) {
    parts.push(`ℹ️ 제외: ${[...missing.map((n) => `${n}(미공표)`), ...dropped.map((n) => `${n}(시점 불일치)`)].join(", ")} — ${memberSet.size}사 중 ${aligned.length}사 기준`);
  }
  parts.push(SOURCE_LINE);
  return parts.join("\n\n");
}
