/**
 * FISIS OpenAPI 응답 타입.
 * 봉투 구조 (getMFdata R 패키지 소스로 검증됨):
 *   { result: { err_cd: "000", err_msg: "...", ...메타, list: [...] } }
 * err_cd !== "000" 이면 에러.
 */

export interface FisisEnvelope<T> {
  result: {
    err_cd: string;
    err_msg: string;
    list?: T[];
    [key: string]: unknown;
  };
}

/** companySearch — 권역별 금융회사 목록. 파라미터: partDiv */
export interface RawCompany {
  finance_cd: string;
  finance_nm: string;
  /** 일부 응답에 권역 정보가 포함될 수 있음 — 요청 partDiv를 신뢰 소스로 사용 */
  [key: string]: unknown;
}

/** statisticsListSearch — 통계표 목록. 파라미터: lrgDiv (권역 대분류, financeCd 아님!) */
export interface RawStatList {
  list_no: string;
  list_nm: string;
  [key: string]: unknown;
}

/** accountListSearch — 통계표별 계정항목. 파라미터: listNo */
export interface RawAccount {
  account_cd: string;
  account_nm: string;
  [key: string]: unknown;
}

/** statisticsInfoSearch — 통계 데이터. 파라미터: financeCd, listNo, accountCd?, term(Y|H|Q), startBaseMm, endBaseMm */
export interface RawStatRow {
  base_month: string; // YYYYMM
  finance_cd: string;
  finance_nm?: string;
  account_cd?: string;
  account_nm?: string;
  a?: string | number; // 값 컬럼 (FISIS는 a, b, ... 로 다중 값 컬럼 제공 가능)
  value?: string | number;
  unit_nm?: string;
  [key: string]: unknown;
}

export type Term = "Y" | "H" | "Q";

export type Sector =
  | "bank"
  | "insurance_life"
  | "insurance_nonlife"
  | "securities"
  | "savings_bank"
  | "card"
  | "holding";

export interface Company {
  financeCd: string;
  name: string;
  nameNormalized: string;
  sector: Sector;
}
