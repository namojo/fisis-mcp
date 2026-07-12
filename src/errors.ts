/**
 * 원칙: tool은 절대 스택트레이스나 빈 문자열을 반환하지 않는다.
 * 모든 에러는 에이전트가 "다음 행동"을 결정할 수 있는 한국어 문장으로 변환된다.
 */

export class FisisError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    /** 에이전트에게 제안하는 다음 행동 */
    public readonly hint?: string,
  ) {
    super(message);
    this.name = "FisisError";
  }

  /** tool 응답용 마크다운 */
  toToolText(): string {
    const lines = [`⚠️ ${this.message}`];
    if (this.hint) lines.push(`→ ${this.hint}`);
    return lines.join("\n");
  }
}

export function missingApiKeyError(): FisisError {
  return new FisisError(
    "FISIS_API_KEY 환경변수가 설정되지 않았습니다.",
    "NO_API_KEY",
    "https://fisis.fss.or.kr/openapi 에서 무료 인증키를 발급받아 MCP 설정의 env에 추가한 뒤 서버를 재시작하세요.",
  );
}

/** FISIS err_cd → 사용자 메시지 매핑 */
export function fromFisisErrCode(errCd: string, errMsg: string): FisisError {
  const known: Record<string, { msg: string; hint: string }> = {
    "010": {
      msg: "인증키가 유효하지 않습니다.",
      hint: "FISIS_API_KEY 값을 확인하세요. 키는 https://fisis.fss.or.kr/openapi 에서 재발급 가능합니다.",
    },
    "011": {
      msg: "일일 호출 한도를 초과했을 수 있습니다.",
      hint: "캐시된 데이터로 조회를 좁히거나 내일 다시 시도하세요.",
    },
    "100": {
      msg: "필수 파라미터가 누락되었거나 잘못되었습니다.",
      hint: "financeCd / listNo / 기간(YYYYMM) 형식을 확인하세요.",
    },
    "200": {
      msg: "해당 조건의 데이터가 없습니다.",
      hint: "기간을 조정하거나 fisis_list_statistics 로 제공 통계표를 먼저 확인하세요. FISIS 공표는 분기 종료 후 2~3개월 시차가 있습니다.",
    },
  };
  const k = known[errCd];
  return new FisisError(
    k ? k.msg : `FISIS API 오류 (${errCd}): ${errMsg}`,
    `FISIS_${errCd}`,
    k?.hint ?? "파라미터를 확인하거나 fisis_list_statistics 로 유효한 통계표를 탐색하세요.",
  );
}

export function toSafeMessage(e: unknown): string {
  if (e instanceof FisisError) return e.toToolText();
  if (e instanceof Error) {
    // API 키가 URL에 포함된 채 에러 메시지에 노출되는 것 방지
    const masked = e.message.replace(/auth=[^&\s]+/g, "auth=***");
    return `⚠️ 예상치 못한 오류: ${masked}\n→ 잠시 후 재시도하거나 기간/조건을 좁혀서 다시 호출하세요.`;
  }
  return "⚠️ 알 수 없는 오류가 발생했습니다. 조건을 바꿔 재시도하세요.";
}
