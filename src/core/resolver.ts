/**
 * 회사명 → financeCd 해석기.
 * 매칭 순서: financeCd 직접입력 → 완전일치 → 정규화일치 → 부분일치 → 편집거리 제안
 * 다의성(후보 2+)은 확정하지 않고 후보를 반환한다 — 에이전트가 재호출하도록.
 */
import { companySearch } from "../fisis/client.js";
import { SECTORS } from "../domain/sectors.js";
import type { Company, Sector } from "../fisis/types.js";
import { cache } from "./cache.js";
import { missingApiKeyError } from "../errors.js";

/** 흔한 별칭 → 정식명 힌트 */
const ALIASES: Record<string, string> = {
  "국민은행": "국민은행",
  "kb국민은행": "국민은행",
  "농협": "농협은행",
  "농협은행": "농협은행",
  "nh농협은행": "농협은행",
  "신한": "신한은행",
  "하나": "하나은행",
  "우리": "우리은행",
  "카뱅": "카카오뱅크",
  "케뱅": "케이뱅크",
  "kdb생명": "케이디비생명보험",
  "kdb생명보험": "케이디비생명보험",
  "nh농협생명": "농협생명보험",
  "nh농협손해보험": "농협손해보험",
  "sc제일은행": "한국스탠다드차타드은행",
  "제일은행": "한국스탠다드차타드은행",
  "sc은행": "한국스탠다드차타드은행",
  "dgb": "아이엠뱅크",
  "im뱅크": "아이엠뱅크",
  "대구은행": "아이엠뱅크", // 2024 사명 변경 (FISIS 등록명: 아이엠뱅크)
};

export function normalizeName(name: string): string {
  return name
    .replace(/주식회사|㈜|\(주\)/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** 전 권역 회사 목록 로드 (30일 캐시) */
export async function loadAllCompanies(sectorFilter?: Sector): Promise<Company[]> {
  // 키 누락은 여기서 즉시 표면화 — 권역별 catch에 묻히면 "회사 없음"으로 오진된다
  if (!process.env.FISIS_API_KEY?.trim()) throw missingApiKeyError();

  const key = "companies:all";
  let all = cache.get<Company[]>(key);
  if (!all) {
    let firstError: unknown = null;
    const results = await Promise.all(
      SECTORS.map(async (s) => {
        try {
          const raw = await companySearch(s.partDiv);
          return raw
            .filter((r) => !String(r.finance_nm).includes("[폐]")) // 폐업 회사 제외 (실측: [폐] 접미사)
            .map((r) => ({
              financeCd: String(r.finance_cd),
              name: String(r.finance_nm),
              nameNormalized: normalizeName(String(r.finance_nm)),
              sector: s.sector,
              path: String((r as Record<string, unknown>).finance_path ?? ""),
            }));
        } catch (e) {
          firstError ??= e;
          console.error(`[fisis-mcp] companySearch failed for ${s.sector}: ${e instanceof Error ? e.message : e}`);
          return [] as Company[];
        }
      }),
    );
    all = results.flat();
    // 전 권역 실패 = 인증키 무효/네트워크 문제 — 조용히 빈 목록 반환 금지
    if (all.length === 0 && firstError) throw firstError;
    if (all.length > 0) cache.set(key, all, "codes");
  }
  return sectorFilter ? all.filter((c) => c.sector === sectorFilter) : all;
}

export interface ResolveResult {
  status: "resolved" | "ambiguous" | "not_found";
  match?: Company;
  candidates: Company[];
}

export async function resolveCompany(query: string, sector?: Sector): Promise<ResolveResult> {
  const companies = await loadAllCompanies(sector);
  const trimmed = query.trim();

  // 1) financeCd 직접 입력 (숫자 7자리)
  if (/^\d{7}$/.test(trimmed)) {
    const byCd = companies.find((c) => c.financeCd === trimmed);
    if (byCd) return { status: "resolved", match: byCd, candidates: [byCd] };
  }

  const norm = normalizeName(ALIASES[normalizeName(trimmed)] ?? trimmed);

  // 2) 완전일치 / 정규화 일치
  const exact = companies.filter((c) => c.nameNormalized === norm);
  if (exact.length === 1) return { status: "resolved", match: exact[0], candidates: exact };
  if (exact.length > 1) return { status: "ambiguous", candidates: exact.slice(0, 10) };

  // 3) 부분일치
  const partial = companies.filter(
    (c) => c.nameNormalized.includes(norm) || norm.includes(c.nameNormalized),
  );
  if (partial.length === 1) return { status: "resolved", match: partial[0], candidates: partial };
  if (partial.length > 1) return { status: "ambiguous", candidates: partial.slice(0, 10) };

  // 4) 편집거리 상위 3건 제안
  const suggestions = companies
    .map((c) => ({ c, d: editDistance(norm, c.nameNormalized) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map((x) => x.c);
  return { status: "not_found", candidates: suggestions };
}
