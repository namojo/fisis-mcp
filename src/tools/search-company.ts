import { resolveCompany } from "../core/resolver.js";
import { resolveSector, SECTORS } from "../domain/sectors.js";
import { mdTable, SOURCE_LINE } from "../core/formatter.js";
import type { Sector } from "../fisis/types.js";

export async function searchCompanyTool(args: { query: string; sector?: string }): Promise<string> {
  let sector: Sector | undefined;
  if (args.sector) {
    const s = resolveSector(args.sector);
    if (!s) {
      return `⚠️ 알 수 없는 권역 '${args.sector}'\n→ 사용 가능: ${SECTORS.map((x) => `${x.sector}(${x.label})`).join(", ")}`;
    }
    sector = s.sector;
  }

  const result = await resolveCompany(args.query, sector);
  const label = (s: Sector) => SECTORS.find((x) => x.sector === s)?.label ?? s;

  if (result.status === "resolved" && result.match) {
    const c = result.match;
    return [
      `✅ 회사 확정: **${c.name}**`,
      mdTable(["financeCd", "회사명", "권역"], [[c.financeCd, c.name, label(c.sector)]]),
      `→ 이 financeCd로 fisis_key_indicators 또는 fisis_get_statistics 를 호출하세요.`,
      SOURCE_LINE,
    ].join("\n\n");
  }

  if (result.status === "ambiguous") {
    return [
      `'${args.query}' 에 해당하는 회사가 ${result.candidates.length}곳입니다. financeCd를 지정해 다시 호출하세요.`,
      mdTable(
        ["financeCd", "회사명", "권역"],
        result.candidates.map((c) => [c.financeCd, c.name, label(c.sector)]),
      ),
      SOURCE_LINE,
    ].join("\n\n");
  }

  return [
    `'${args.query}' 와 일치하는 금융회사를 찾지 못했습니다. 유사 후보:`,
    mdTable(
      ["financeCd", "회사명", "권역"],
      result.candidates.map((c) => [c.financeCd, c.name, label(c.sector)]),
    ),
    `→ 의도한 회사가 있으면 해당 financeCd로 재호출하세요. 없으면 sector 필터를 바꿔 재검색하세요.`,
  ].join("\n\n");
}
