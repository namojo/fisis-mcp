/**
 * verify-presets: 프리셋의 listNo/accountCd 후보를 실측 API로 탐색·출력한다.
 *
 * 사용법 (한국 IP + FISIS_API_KEY 필요):
 *   npm run build && FISIS_API_KEY=발급키 npm run verify-presets
 *
 * 출력을 보고 src/domain/indicator-presets.ts 의 listNo/accountCd 를 채우고
 * verified: true 로 변경한다. 분기 1회 재실행 권장 (통계표 개편 감지).
 */
import { accountListSearch, statisticsListSearch } from "../src/fisis/client.js";
import { PRESETS } from "../src/domain/indicator-presets.js";
import { SECTORS } from "../src/domain/sectors.js";

async function main() {
  if (!process.env.FISIS_API_KEY) {
    console.error("FISIS_API_KEY 환경변수가 필요합니다.");
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;

  for (const sectorDef of SECTORS) {
    const presets = PRESETS.filter((p) => p.sector === sectorDef.sector);
    if (presets.length === 0) continue;

    console.log(`\n═══ ${sectorDef.label} (lrgDiv=${sectorDef.lrgDiv}) ═══`);
    let lists;
    try {
      lists = await statisticsListSearch(sectorDef.lrgDiv);
      console.log(`  통계표 ${lists.length}개 확인`);
    } catch (e) {
      console.log(`  ⚠️ 통계표 목록 조회 실패: ${e instanceof Error ? e.message : e}`);
      console.log(`  → lrgDiv 코드가 잘못됐을 수 있음. FISIS OpenAPI 문서의 권역코드표 확인 필요.`);
      fail += presets.length;
      continue;
    }

    for (const preset of presets) {
      const listCands = lists.filter((l) =>
        preset.searchHints.list.some((h) => String(l.list_nm).includes(h)),
      );
      if (listCands.length === 0) {
        console.log(`  ✗ ${preset.key}: 통계표 후보 없음 (hints: ${preset.searchHints.list.join(",")})`);
        fail++;
        continue;
      }
      let found = false;
      for (const l of listCands.slice(0, 5)) {
        const accounts = await accountListSearch(String(l.list_no));
        const hits = accounts.filter((a) =>
          preset.searchHints.account.some((h) => String(a.account_nm).includes(h)),
        );
        if (hits.length > 0) {
          console.log(`  ✓ ${preset.key} (${preset.label})`);
          for (const h of hits.slice(0, 3)) {
            console.log(`      listNo: "${l.list_no}" (${l.list_nm}) / accountCd: "${h.account_cd}" (${h.account_nm})`);
          }
          found = true;
          ok++;
          break;
        }
      }
      if (!found) {
        console.log(`  ✗ ${preset.key}: 계정항목 후보 없음 — 후보 통계표: ${listCands.slice(0, 3).map((l) => `${l.list_no}(${l.list_nm})`).join(", ")}`);
        fail++;
      }
    }
  }

  console.log(`\n결과: ${ok}개 확인 / ${fail}개 미확인`);
  console.log(`→ 위 listNo/accountCd 를 indicator-presets.ts 에 반영하고 verified: true 로 변경하세요.`);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
