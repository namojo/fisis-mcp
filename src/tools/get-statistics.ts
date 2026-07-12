import { statisticsInfoSearch } from "../fisis/client.js";
import { baseMonthToLabel, fmtNumber, mdTable, SOURCE_LINE } from "../core/formatter.js";
import type { Term } from "../fisis/types.js";

const MAX_ROWS = Number(process.env.FISIS_MAX_ROWS ?? 60);

export async function getStatisticsTool(args: {
  financeCd: string;
  listNo: string;
  accountCd?: string;
  term?: Term;
  startBaseMm: string;
  endBaseMm: string;
}): Promise<string> {
  if (!/^\d{6}$/.test(args.startBaseMm) || !/^\d{6}$/.test(args.endBaseMm)) {
    return "⚠️ 기간 형식 오류 — startBaseMm/endBaseMm 은 YYYYMM 6자리여야 합니다 (예: '202503').";
  }
  const term = args.term ?? "Q";
  const rows = await statisticsInfoSearch({ ...args, term });

  if (rows.length === 0) {
    return [
      `해당 조건의 데이터가 없습니다 (financeCd=${args.financeCd}, listNo=${args.listNo}, ${args.startBaseMm}~${args.endBaseMm}).`,
      `→ FISIS 공표는 분기 종료 후 2~3개월 시차가 있습니다. 기간을 한 분기 앞으로 조정하거나, fisis_list_statistics 로 통계표 코드를 재확인하세요.`,
    ].join("\n");
  }

  const truncated = rows.length > MAX_ROWS;
  const shown = truncated ? rows.slice(-MAX_ROWS) : rows; // 최근 우선

  const companyName = String(shown[0].finance_nm ?? args.financeCd);
  const unit = shown.find((r) => r.unit_nm)?.unit_nm;

  const tableRows = shown.map((r) => [
    baseMonthToLabel(String(r.base_month), term),
    String(r.account_nm ?? args.accountCd ?? "-"),
    fmtNumber(r.a ?? r.value, unit ? String(unit) : undefined),
  ]);

  const parts = [
    `## ${companyName} — ${args.listNo}${args.accountCd ? ` / ${args.accountCd}` : ""}`,
    mdTable(["시점", "계정항목", `값${unit ? ` (${unit})` : ""}`], tableRows),
  ];
  if (truncated) {
    parts.push(`ℹ️ ${rows.length - MAX_ROWS}행 생략됨 (최근 데이터 우선). 전체가 필요하면 기간을 좁혀 나눠 조회하세요.`);
  }
  parts.push(SOURCE_LINE);
  return parts.join("\n\n");
}
