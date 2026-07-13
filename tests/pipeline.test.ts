/**
 * 모의 통합 테스트: FISIS 응답 봉투를 재현한 mock fetch로
 * resolver → indicator-service → tool 포매팅 전체 파이프라인 검증.
 * (FISIS는 해외 IP 차단 — 실 API 테스트는 로컬에서 verify-presets로)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function envelope(list: unknown[]) {
  return { result: { err_cd: "000", err_msg: "정상", list } };
}

const MOCK_COMPANIES: Record<string, unknown[]> = {
  A: [
    { finance_cd: "0010001", finance_nm: "국민은행" },
    { finance_cd: "0010002", finance_nm: "신한은행" },
    { finance_cd: "0010927", finance_nm: "카카오뱅크" },
  ],
};

const MOCK_LISTS = [
  { list_no: "SA100", list_nm: "자본적정성 현황" },
  { list_no: "SA200", list_nm: "자산건전성 현황" },
];

// 실측 확정 코드 기준 (SA014/A=BIS, SA015/C=NPL)
const MOCK_ACCOUNTS: Record<string, unknown[]> = {
  SA014: [{ account_cd: "A", account_nm: "BIS기준 자기자본비율" }],
  SA015: [{ account_cd: "C", account_nm: "고정이하여신비율" }],
};

function mockFetch(url: string): Response {
  const u = new URL(url);
  const path = u.pathname;
  let body: unknown;
  if (path.includes("companySearch")) {
    body = envelope(MOCK_COMPANIES[u.searchParams.get("partDiv") ?? ""] ?? []);
  } else if (path.includes("statisticsListSearch")) {
    body = envelope(u.searchParams.get("lrgDiv") === "A" ? MOCK_LISTS : []);
  } else if (path.includes("accountListSearch")) {
    body = envelope(MOCK_ACCOUNTS[u.searchParams.get("listNo") ?? ""] ?? []);
  } else if (path.includes("statisticsInfoSearch")) {
    const cd = u.searchParams.get("financeCd");
    const acct = u.searchParams.get("accountCd");
    const isBis = acct === "A";
    body = envelope([
      { base_month: "202512", finance_cd: cd, finance_nm: "국민은행", account_cd: acct, account_nm: isBis ? "BIS기준 총자본비율" : "고정이하여신비율", a: isBis ? "17.21" : "0.34", unit_nm: "%" },
      { base_month: "202603", finance_cd: cd, finance_nm: "국민은행", account_cd: acct, account_nm: isBis ? "BIS기준 총자본비율" : "고정이하여신비율", a: isBis ? "17.55" : "0.31", unit_nm: "%" },
    ]);
  } else {
    body = { result: { err_cd: "100", err_msg: "unknown endpoint" } };
  }
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("pipeline with mocked FISIS", () => {
  beforeEach(() => {
    process.env.FISIS_API_KEY = "TESTKEY";
    process.env.FISIS_CACHE_DIR = `/tmp/fisis-test-${Date.now()}-${Math.random()}`;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => mockFetch(String(input))));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("resolves company exactly", async () => {
    const { resolveCompany } = await import("../src/core/resolver.js");
    const r = await resolveCompany("국민은행");
    expect(r.status).toBe("resolved");
    expect(r.match?.financeCd).toBe("0010001");
  });

  it("resolves alias 카뱅 → 카카오뱅크", async () => {
    const { resolveCompany } = await import("../src/core/resolver.js");
    const r = await resolveCompany("카뱅");
    expect(r.status).toBe("resolved");
    expect(r.match?.name).toBe("카카오뱅크");
  });

  it("suggests candidates for unknown company", async () => {
    const { resolveCompany } = await import("../src/core/resolver.js");
    const r = await resolveCompany("한국우주은행");
    expect(r.status).toBe("not_found");
    expect(r.candidates.length).toBeGreaterThan(0);
  });

  it("key_indicators returns formatted table with trend", async () => {
    const { keyIndicatorsTool } = await import("../src/tools/key-indicators.js");
    const text = await keyIndicatorsTool({ company: "국민은행", indicators: ["BIS비율", "NPL비율"] });
    expect(text).toContain("국민은행 핵심 경영지표");
    expect(text).toContain("BIS자기자본비율(%)");
    expect(text).toContain("17.55");
    expect(text).toContain("↗"); // BIS 상승 추세
    expect(text).toContain("출처: 금융감독원");
  });

  it("fetches verified preset codes directly (SA015/C)", async () => {
    const { fetchIndicator } = await import("../src/core/indicator-service.js");
    const s = await fetchIndicator("npl_ratio", "0010001", "202510", "202603");
    expect(s.points.get("202603")).toBe(0.31);
  });
});
