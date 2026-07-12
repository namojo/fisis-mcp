#!/usr/bin/env node
/**
 * fisis-mcp — 금융감독원 금융통계정보시스템(FISIS) MCP 서버
 *
 * Tool 계층:
 *   상위(자주 사용): fisis_key_indicators, fisis_compare_peers, fisis_profile_institution
 *   하위(탐색/원자 조회): fisis_search_company, fisis_list_statistics, fisis_get_statistics
 *
 * CRITICAL: stdout은 MCP JSON-RPC 채널. 모든 로그는 console.error (stderr).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { toSafeMessage } from "./errors.js";
import { searchCompanyTool } from "./tools/search-company.js";
import { listStatisticsTool } from "./tools/list-statistics.js";
import { getStatisticsTool } from "./tools/get-statistics.js";
import { keyIndicatorsTool } from "./tools/key-indicators.js";
import { comparePeersTool } from "./tools/compare-peers.js";
import { profileTool } from "./tools/profile.js";

const server = new McpServer({ name: "fisis-mcp", version: "0.1.0" });

/** 공통 래퍼: 어떤 에러도 에이전트가 행동 가능한 텍스트로 변환 */
function wrap<T>(fn: (args: T) => Promise<string>) {
  return async (args: T) => {
    try {
      const text = await fn(args);
      return { content: [{ type: "text" as const, text }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: toSafeMessage(e) }], isError: true };
    }
  };
}

server.tool(
  "fisis_search_company",
  "금융회사 이름으로 FISIS 회사코드(financeCd)를 찾는다. 회사명이 다의적이거나(예: 'KB') 다른 tool이 후보 목록을 반환했을 때 사용. " +
    "이미 정확한 회사명을 알고 지표가 필요하면 fisis_key_indicators 를 바로 호출하는 것이 빠르다.",
  {
    query: z.string().describe("회사명 (부분명·별칭 가능, 예: '국민은행', '카뱅') 또는 7자리 financeCd"),
    sector: z.string().optional().describe("권역 필터: bank, insurance_life, insurance_nonlife, securities, savings_bank, card, holding"),
  },
  wrap(searchCompanyTool),
);

server.tool(
  "fisis_list_statistics",
  "권역별 제공 통계표와 계정항목을 탐색한다. 핵심지표 프리셋(fisis_key_indicators)에 없는 특수 지표(예: 지역별 점포현황, 업종별 대출금)를 찾을 때 사용. " +
    "keyword를 지정하면 계정항목까지 확장 검색한다.",
  {
    sector: z.string().describe("권역: bank, insurance_life, insurance_nonlife, securities, savings_bank, card, holding"),
    keyword: z.string().optional().describe("통계표명/계정명 키워드 (예: '연체', '점포', '유지율')"),
  },
  wrap(listStatisticsTool),
);

server.tool(
  "fisis_get_statistics",
  "통계표(listNo)·계정(accountCd)·기간을 지정한 원자적 데이터 조회. fisis_list_statistics 로 코드를 확인한 뒤 사용. " +
    "일반적인 핵심지표(BIS, ROA, K-ICS 등)는 fisis_key_indicators 가 더 간단하다.",
  {
    financeCd: z.string().describe("7자리 금융회사 코드"),
    listNo: z.string().describe("통계표 번호 (예: 'SA053')"),
    accountCd: z.string().optional().describe("계정항목 코드 (생략 시 통계표 전체)"),
    term: z.enum(["Y", "H", "Q"]).optional().describe("주기: Y연간/H반기/Q분기 (기본 Q)"),
    startBaseMm: z.string().describe("시작 기준월 YYYYMM (예: '202403')"),
    endBaseMm: z.string().describe("종료 기준월 YYYYMM"),
  },
  wrap(getStatisticsTool),
);

server.tool(
  "fisis_key_indicators",
  "금융회사 1곳의 핵심 경영지표를 한 번에 조회한다. 은행(BIS·NPL·ROA·ROE·예대율), 보험(K-ICS·유지율), 증권(NCR), 저축은행(BIS·NPL), 카드(연체율) 등 " +
    "권역별 기본 세트가 내장되어 있다. '○○은행 건전성 지표', '삼성생명 K-ICS' 같은 요청의 1차 선택지.",
  {
    company: z.string().describe("회사명 또는 financeCd"),
    indicators: z.array(z.string()).optional().describe("지표 별칭 목록 (예: ['BIS비율','ROA']). 생략 시 권역 기본 세트"),
    periods: z.number().int().min(1).max(12).optional().describe("최근 N개 분기 (기본 4)"),
  },
  wrap(keyIndicatorsTool),
);

server.tool(
  "fisis_compare_peers",
  "특정 지표를 동종그룹(시중은행/지방은행/인터넷은행/주요 생보·손보)과 비교해 순위·평균·격차를 계산한다. " +
    "'○○은행 BIS비율은 업권 평균 대비 어느 위치' 같은 벤치마킹 문장의 근거를 만들 때 사용.",
  {
    company: z.string().describe("기준 회사명"),
    indicator: z.string().describe("지표 별칭 (예: 'BIS비율', 'K-ICS', '연체율')"),
    peerGroup: z.string().optional().describe("그룹: major_commercial_banks, regional_banks, internet_banks, top_life_insurers, top_nonlife_insurers. 생략 시 회사 권역으로 자동 선택"),
    baseMm: z.string().optional().describe("기준월 YYYYMM. 생략 시 최신 공표 분기 자동"),
  },
  wrap(comparePeersTool),
);

server.tool(
  "fisis_profile_institution",
  "금융회사 종합 프로파일: 기본정보 + 핵심지표 최근 4분기 + 업권 내 위치를 한 번에 반환한다. " +
    "제안서의 '대상기관 분석' 섹션, '○○은행 종합 분석해줘' 같은 요청의 1차 선택지. 내부적으로 여러 API를 호출하므로 특정 지표 하나만 필요하면 fisis_key_indicators 를 사용.",
  {
    company: z.string().describe("회사명"),
    focus: z.string().optional().describe("강조 관점: '건전성' | '수익성' | '성장성'"),
  },
  wrap(profileTool),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[fisis-mcp] server started (stdio)");
  if (!process.env.FISIS_API_KEY) {
    console.error("[fisis-mcp] ⚠️  FISIS_API_KEY 미설정 — tool 호출 시 발급 안내가 반환됩니다");
  }
}

main().catch((e) => {
  console.error("[fisis-mcp] fatal:", e);
  process.exit(1);
});
