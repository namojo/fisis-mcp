/**
 * 지표 조회 서비스.
 * - verified 프리셋: listNo/accountCd로 즉시 조회
 * - 미검증 프리셋: searchHints로 통계표·계정을 동적 탐색 후 조회 (발견 코드는 캐시)
 * - K-ICS처럼 availableFrom 이전 기간은 fallbackKey로 자동 분기
 */
import { accountListSearch, statisticsInfoSearch, statisticsListSearch } from "../fisis/client.js";
import { PRESETS, DEFAULT_SETS, type IndicatorPreset } from "../domain/indicator-presets.js";
import { SECTORS } from "../domain/sectors.js";
import type { RawStatRow, Sector, Term } from "../fisis/types.js";
import { cache } from "./cache.js";
import { FisisError } from "../errors.js";

interface ResolvedCodes { listNo: string; accountCd: string }

async function discoverCodes(preset: IndicatorPreset): Promise<ResolvedCodes> {
  const cacheKey = `preset-codes:${preset.key}`;
  const cached = cache.get<ResolvedCodes>(cacheKey);
  if (cached) return cached;

  const sectorDef = SECTORS.find((s) => s.sector === preset.sector);
  if (!sectorDef) throw new FisisError(`알 수 없는 권역: ${preset.sector}`, "BAD_SECTOR");

  const lists = await statisticsListSearch(sectorDef.lrgDiv);
  const listCandidates = lists.filter((l) =>
    preset.searchHints.list.some((h) => String(l.list_nm).includes(h)),
  );
  if (listCandidates.length === 0) {
    throw new FisisError(
      `'${preset.label}' 통계표를 찾지 못했습니다 (프리셋 갱신 필요).`,
      "PRESET_STALE",
      `fisis_list_statistics 로 '${preset.searchHints.list[0]}' 키워드 탐색 후 fisis_get_statistics 를 직접 사용하세요.`,
    );
  }

  for (const l of listCandidates.slice(0, 5)) {
    const accounts = await accountListSearch(String(l.list_no));
    const hit = accounts.find((a) =>
      preset.searchHints.account.some((h) => String(a.account_nm).includes(h)),
    );
    if (hit) {
      const codes = { listNo: String(l.list_no), accountCd: String(hit.account_cd) };
      cache.set(cacheKey, codes, "codes");
      console.error(`[fisis-mcp] preset '${preset.key}' resolved: ${codes.listNo}/${codes.accountCd}`);
      return codes;
    }
  }
  throw new FisisError(
    `'${preset.label}' 계정항목을 찾지 못했습니다.`,
    "PRESET_STALE",
    `fisis_list_statistics keyword='${preset.searchHints.account[0]}' 로 직접 탐색하세요.`,
  );
}

export interface IndicatorSeries {
  preset: IndicatorPreset;
  /** baseMm(YYYYMM) → 값 */
  points: Map<string, number | null>;
  note?: string;
}

/** 값 컬럼 추출: FISIS 응답은 a(또는 value) 필드에 값 */
function extractValue(row: RawStatRow): number | null {
  const raw = row.a ?? row.value;
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
}

export async function fetchIndicator(
  presetKey: string,
  financeCd: string,
  startBaseMm: string,
  endBaseMm: string,
  term: Term = "Q",
): Promise<IndicatorSeries> {
  const preset = PRESETS.find((p) => p.key === presetKey);
  if (!preset) throw new FisisError(`프리셋 없음: ${presetKey}`, "NO_PRESET");
  // 참고: K-ICS/RBC는 SH021·SI021에 연속 수록됨이 실측 확인되어 기간 분기 로직 불필요
  const note: string | undefined = undefined;

  const codes: ResolvedCodes =
    preset.verified && preset.listNo && preset.accountCd
      ? { listNo: preset.listNo, accountCd: preset.accountCd }
      : await discoverCodes(preset);

  const rows = await statisticsInfoSearch({
    financeCd,
    listNo: codes.listNo,
    accountCd: codes.accountCd,
    term,
    startBaseMm,
    endBaseMm,
  });

  const points = new Map<string, number | null>();
  for (const r of rows) points.set(String(r.base_month), extractValue(r));
  return { preset, points, note };
}

/** 여러 지표 병렬 조회 — 일부 실패 허용, 동시 5개 제한 */
export async function fetchIndicators(
  presetKeys: string[],
  financeCd: string,
  startBaseMm: string,
  endBaseMm: string,
): Promise<Array<IndicatorSeries | { presetKey: string; error: string }>> {
  const results: Array<IndicatorSeries | { presetKey: string; error: string }> = [];
  const CONCURRENCY = 5;
  for (let i = 0; i < presetKeys.length; i += CONCURRENCY) {
    const batch = presetKeys.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((k) => fetchIndicator(k, financeCd, startBaseMm, endBaseMm)),
    );
    settled.forEach((s, idx) => {
      if (s.status === "fulfilled") results.push(s.value);
      else
        results.push({
          presetKey: batch[idx],
          error: s.reason instanceof FisisError ? s.reason.message : "조회 실패",
        });
    });
  }
  return results;
}

export function defaultPresetsFor(sector: Sector): string[] {
  return DEFAULT_SETS[sector] ?? [];
}
