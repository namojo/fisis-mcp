import { accountListSearch, statisticsListSearch } from "../fisis/client.js";
import { resolveSector, SECTORS } from "../domain/sectors.js";
import { mdTable, SOURCE_LINE } from "../core/formatter.js";

const MAX_LISTS = 25;
const MAX_ACCOUNT_EXPAND = 8; // keyword 검색 시 계정항목까지 열어볼 통계표 수

export async function listStatisticsTool(args: { sector: string; keyword?: string }): Promise<string> {
  const sectorDef = resolveSector(args.sector);
  if (!sectorDef) {
    return `⚠️ 알 수 없는 권역 '${args.sector}'\n→ 사용 가능: ${SECTORS.map((x) => `${x.sector}(${x.label})`).join(", ")}`;
  }

  const lists = await statisticsListSearch(sectorDef.lrgDiv);

  if (!args.keyword) {
    // 전체 덤프 금지 — 개수와 대표 통계표만
    const sample = lists.slice(0, MAX_LISTS);
    return [
      `## ${sectorDef.label} 통계표 (전체 ${lists.length}개 중 ${sample.length}개 표시)`,
      mdTable(["listNo", "통계표명"], sample.map((l) => [String(l.list_no), String(l.list_nm)])),
      `→ 원하는 주제가 안 보이면 keyword 파라미터로 좁혀서 재호출하세요 (예: keyword='연체').`,
      SOURCE_LINE,
    ].join("\n\n");
  }

  const kw = args.keyword.trim();
  const matchedLists = lists.filter((l) => String(l.list_nm).includes(kw));

  // 통계표명 매칭 + 계정항목 확장 검색
  const accountHits: Array<{ listNo: string; listNm: string; accountCd: string; accountNm: string }> = [];
  const expandTargets = matchedLists.length > 0 ? matchedLists.slice(0, MAX_ACCOUNT_EXPAND) : lists.slice(0, 0);
  // 통계표명에 키워드가 없어도 계정 레벨 매칭 가능성 — 상위 통계표 일부 탐색
  const probeTargets = matchedLists.length > 0 ? expandTargets : lists.slice(0, MAX_ACCOUNT_EXPAND);
  for (const l of probeTargets) {
    try {
      const accounts = await accountListSearch(String(l.list_no));
      for (const a of accounts.filter((a) => String(a.account_nm).includes(kw)).slice(0, 5)) {
        accountHits.push({
          listNo: String(l.list_no),
          listNm: String(l.list_nm),
          accountCd: String(a.account_cd),
          accountNm: String(a.account_nm),
        });
      }
    } catch {
      /* 개별 통계표 실패 무시 */
    }
  }

  const parts: string[] = [`## '${kw}' 검색 결과 (${sectorDef.label})`];
  if (matchedLists.length > 0) {
    parts.push(
      `### 통계표명 매칭 (${matchedLists.length}건)`,
      mdTable(["listNo", "통계표명"], matchedLists.slice(0, MAX_LISTS).map((l) => [String(l.list_no), String(l.list_nm)])),
    );
  }
  if (accountHits.length > 0) {
    parts.push(
      `### 계정항목 매칭`,
      mdTable(
        ["listNo", "통계표명", "accountCd", "계정항목명"],
        accountHits.map((h) => [h.listNo, h.listNm, h.accountCd, h.accountNm]),
      ),
    );
  }
  if (matchedLists.length === 0 && accountHits.length === 0) {
    parts.push(`매칭 결과 없음. 다른 키워드로 재시도하거나 keyword 없이 호출해 전체 카테고리를 확인하세요.`);
  } else {
    parts.push(`→ listNo/accountCd를 fisis_get_statistics 에 넘겨 데이터를 조회하세요.`);
  }
  parts.push(SOURCE_LINE);
  return parts.join("\n\n");
}
