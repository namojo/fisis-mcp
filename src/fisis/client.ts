/**
 * FISIS OpenAPI 클라이언트.
 * - 모든 호출은 캐시 우선
 * - 429/5xx 지수 백오프 재시도 2회
 * - CRITICAL: stdout은 MCP JSON-RPC 채널 — 로그는 반드시 stderr(console.error)
 * - API 키는 로그·에러에 절대 노출 금지
 */
import { cache } from "../core/cache.js";
import { FisisError, fromFisisErrCode, missingApiKeyError } from "../errors.js";
import type { FisisEnvelope, RawAccount, RawCompany, RawStatList, RawStatRow, Term } from "./types.js";

const BASE = "https://fisis.fss.or.kr/openapi";
const TIMEOUT_MS = 15_000;
const ALLOWED_HOST = "fisis.fss.or.kr"; // 허용 도메인 하드코딩
/**
 * CRITICAL (실측): FISIS WAF는 curl/node 기본 UA를 무응답 드롭한다.
 * 브라우저 UA가 없으면 타임아웃 — IP 차단으로 오진하기 쉬움.
 */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function apiKey(): string {
  const k = process.env.FISIS_API_KEY?.trim();
  if (!k) throw missingApiKeyError();
  return k;
}

function log(msg: string): void {
  console.error(`[fisis-mcp] ${msg}`);
}

async function callApi<T>(
  endpoint: string,
  params: Record<string, string>,
  cacheKind: "codes" | "data",
): Promise<T[]> {
  const lang = process.env.FISIS_LANG ?? "kr";
  const qs = new URLSearchParams({ lang, ...params }); // URLSearchParams가 인코딩 처리
  const cacheKey = `${endpoint}?${qs.toString()}`; // auth 제외 키로 캐시

  const cached = cache.get<T[]>(cacheKey);
  if (cached) {
    log(`cache hit: ${endpoint}`);
    return cached;
  }

  const url = new URL(`${BASE}/${endpoint}.json`);
  if (url.hostname !== ALLOWED_HOST) throw new FisisError("허용되지 않은 호스트", "BAD_HOST");
  qs.forEach((v, k) => url.searchParams.set(k, v));
  url.searchParams.set("auth", apiKey());

  let lastErr: unknown;
  for (let attempt = 0; attempt <= 2; attempt++) {
    if (attempt > 0) {
      const backoff = 500 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, backoff));
      log(`retry ${attempt}: ${endpoint}`);
    }
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new FisisError(
          `FISIS 서버 응답 오류 (HTTP ${res.status})`,
          "HTTP_ERROR",
          res.status === 429 ? "일일 호출 한도에 도달했을 수 있습니다." : "잠시 후 재시도하세요.",
        );
        continue;
      }
      const body = (await res.json()) as FisisEnvelope<T>;
      const errCd = body?.result?.err_cd;
      if (errCd !== "000") {
        throw fromFisisErrCode(errCd ?? "???", body?.result?.err_msg ?? "unknown");
      }
      const list = body.result.list ?? [];
      cache.set(cacheKey, list, cacheKind);
      log(`fetched: ${endpoint} (${list.length} rows)`);
      return list;
    } catch (e) {
      if (e instanceof FisisError && !e.code.startsWith("HTTP")) throw e; // API 레벨 에러는 재시도 무의미
      lastErr = e;
    }
  }
  throw lastErr instanceof FisisError
    ? lastErr
    : new FisisError("FISIS API 연결 실패 (타임아웃/네트워크)", "NETWORK", "네트워크 상태 확인 후 재시도하세요. 참고: FISIS는 해외 IP를 차단할 수 있습니다.");
}

/** 권역별 금융회사 목록. partDiv: FISIS 권역코드 */
export function companySearch(partDiv: string): Promise<RawCompany[]> {
  return callApi<RawCompany>("companySearch", { partDiv }, "codes");
}

/** 통계표 목록. CRITICAL: 파라미터는 lrgDiv(권역 대분류) — financeCd 아님 */
export function statisticsListSearch(lrgDiv: string): Promise<RawStatList[]> {
  return callApi<RawStatList>("statisticsListSearch", { lrgDiv }, "codes");
}

/** 통계표별 계정항목 */
export function accountListSearch(listNo: string): Promise<RawAccount[]> {
  return callApi<RawAccount>("accountListSearch", { listNo }, "codes");
}

/** 통계 데이터 조회 */
export function statisticsInfoSearch(opts: {
  financeCd: string;
  listNo: string;
  accountCd?: string;
  term?: Term;
  startBaseMm: string;
  endBaseMm: string;
}): Promise<RawStatRow[]> {
  const params: Record<string, string> = {
    financeCd: opts.financeCd,
    listNo: opts.listNo,
    term: opts.term ?? "Q",
    startBaseMm: opts.startBaseMm,
    endBaseMm: opts.endBaseMm,
  };
  if (opts.accountCd) params.accountCd = opts.accountCd;
  return callApi<RawStatRow>("statisticsInfoSearch", params, "data");
}
