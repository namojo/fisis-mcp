# fisis-mcp

> 금융감독원 **금융통계정보시스템(FISIS)** OpenAPI를 AI 에이전트에게 연결하는 MCP 서버

[![CI](https://github.com/namojo/fisis-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/namojo/fisis-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

```
"국민은행 BIS비율을 시중은행 평균과 비교해줘"

→ ## BIS총자본비율 벤치마킹 (2026Q1, 시중은행)
   기준회사: 국민은행 17.55% — 그룹 내 2위/7사, 평균 대비 +0.43%p
   | 순위 | 회사 | 값(%) |
   |------|------|-------|
   | 1 | ... | ... |
   그룹 평균: 17.12% / 중앙값: 17.05%
   출처: 금융감독원 금융통계정보시스템(FISIS)
```

## 왜 FISIS인가?

DART가 "기업 한 곳의 속사정"이라면, FISIS는 **"업권 전체의 건강검진표"** 입니다.

| | DART | FISIS |
|---|------|-------|
| 데이터 성격 | 상장사 공시·재무제표 | 금융회사 업무보고서 기반 경영통계 |
| 커버리지 | 상장/공시대상 법인 | **비상장 포함** 전 금융회사 (은행·보험·증권·저축은행·카드) |
| 강점 | 개별 기업 심층 분석 | **업권 횡단 비교** — BIS, K-ICS, NPL, 연체율 등 감독지표 |
| MCP 생태계 | 다수 존재 | **이 프로젝트가 최초** |

"귀사의 BIS비율은 시중은행 평균 대비 X%p" 같은 벤치마킹 문장은 FISIS 없이는 만들 수 없습니다. 금융사업 제안서의 **대상기관 분석 → 시장 환경 → 경쟁 비교** 뼈대를 에이전트가 자율적으로 채우게 하는 것이 이 서버의 목적입니다.

## 아키텍처

```mermaid
flowchart LR
    subgraph Client["MCP 클라이언트"]
        A["Claude Desktop<br/>Claude Code / Cursor"]
    end

    subgraph Server["fisis-mcp"]
        direction TB
        T["6 Tools"]
        R["Resolver<br/>회사명 → financeCd"]
        P["Indicator Presets ★<br/>업권별 핵심지표 매핑"]
        G["Peer Groups<br/>시중은행 / 생보10 / ..."]
        C[("File Cache<br/>코드 30일 / 데이터 24h")]
        T --> R
        T --> P
        T --> G
        R --> C
        P --> C
    end

    subgraph FSS["금융감독원"]
        F["FISIS OpenAPI<br/>fisis.fss.or.kr"]
    end

    A <-->|"JSON-RPC (stdio)"| T
    C <-->|"캐시 미스 시에만"| F
```

핵심 설계 세 가지:

1. **정규화 응답** — 원시 JSON을 그대로 반환하지 않습니다. 단위·출처가 명기된 마크다운 테이블로 가공해 컨텍스트 토큰을 아낍니다.
2. **코드 매핑 흡수** — `회사명→financeCd`, `지표명→listNo/accountCd` 변환 같은 지저분한 부분을 전부 서버가 처리합니다. 에이전트는 "국민은행", "BIS비율" 같은 자연어에 가까운 인자만 넘깁니다.
3. **프리셋 = 도메인 자산** — "은행이면 BIS·NPL, 보험이면 K-ICS, 카드면 연체율"이라는 도메인 지식이 코드로 내장되어 있습니다 (`src/domain/indicator-presets.ts`).

## 빠른 시작

### 1. 인증키 발급 (무료, 5분)

[fisis.fss.or.kr/page/api-key.jsp](https://fisis.fss.or.kr/page/api-key.jsp) (또는 FISIS 홈 → **OPEN API** → **인증키신청** 메뉴)

> ℹ️ FISIS WAF는 curl/node 기본 User-Agent를 무응답 드롭합니다(해외 IP 차단으로 오진하기 쉬움). 이 서버는 브라우저 UA를 내장하여 해외 환경에서도 동작함을 실측 확인했습니다.

### 2. MCP 클라이언트 설정

**Claude Desktop** — `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "fisis": {
      "command": "npx",
      "args": ["-y", "fisis-mcp"],
      "env": { "FISIS_API_KEY": "발급받은키" }
    }
  }
}
```

**Claude Code** — 프로젝트 루트에서:

```bash
claude mcp add fisis -e FISIS_API_KEY=발급받은키 -- npx -y fisis-mcp
```

**소스에서 직접 실행**:

```bash
git clone https://github.com/namojo/fisis-mcp.git
cd fisis-mcp && npm install && npm run build
# MCP 설정의 command를 "node", args를 ["<경로>/dist/src/index.js"]로
```

### 3. 바로 사용

전 프리셋이 실측 검증 완료 상태라 추가 설정이 필요 없습니다.
분기 1회 `npm run verify-presets` 재실행으로 FISIS 통계표 개편을 감지할 수 있습니다.

## Tool 구성과 선택 흐름

6개 tool은 **상위(복합) → 하위(원자)** 계층으로 설계되어 있습니다. 에이전트가 아래 흐름대로 자율 선택합니다:

```mermaid
flowchart TD
    Q["사용자 요청"] --> D1{"어떤 요청?"}

    D1 -->|"'○○은행 종합 분석'<br/>제안서 대상기관 분석"| PROFILE["fisis_profile_institution"]
    D1 -->|"'BIS비율 알려줘'<br/>핵심지표 조회"| KEY["fisis_key_indicators"]
    D1 -->|"'업권 평균과 비교'<br/>벤치마킹"| PEER["fisis_compare_peers"]
    D1 -->|"'지역별 점포현황'<br/>프리셋에 없는 특수지표"| LIST["fisis_list_statistics"]

    KEY -->|"회사명 다의적<br/>(예: 'KB')"| SEARCH["fisis_search_company"]
    SEARCH -->|"financeCd 확정"| KEY
    LIST -->|"listNo/accountCd 확보"| GET["fisis_get_statistics"]

    PROFILE -.->|"내부 조합"| KEY
    PROFILE -.->|"내부 조합"| PEER

    style PROFILE fill:#1B4332,color:#fff
    style KEY fill:#1B4332,color:#fff
    style PEER fill:#1B4332,color:#fff
```

| Tool | 용도 | 언제 |
|------|------|------|
| `fisis_key_indicators` | 회사 1곳의 핵심지표 세트 (최근 N분기 + 추세) | ★ 1차 선택지 |
| `fisis_compare_peers` | 동종그룹 순위·평균·격차 | 벤치마킹 문장 근거 |
| `fisis_profile_institution` | 지표 + 벤치마킹 종합 (composite) | 제안서 대상기관 분석 |
| `fisis_search_company` | 회사명 → financeCd 해석 | 다의성 해소 |
| `fisis_list_statistics` | 613개 통계표·계정 탐색 | 프리셋 밖 특수지표 |
| `fisis_get_statistics` | 코드 직접 지정 원자 조회 | 탐색 후 정밀 조회 |

### 벤치마킹 동작 원리

`fisis_compare_peers` 내부 시퀀스입니다. 시점 정합(공표 시차로 회사마다 최신 분기가 다를 수 있음)이 핵심입니다:

```mermaid
sequenceDiagram
    participant AI as 에이전트
    participant MCP as fisis-mcp
    participant API as FISIS API

    AI->>MCP: compare_peers("국민은행", "BIS비율")
    MCP->>MCP: 회사 해석 + 프리셋 매칭 + 그룹 자동선택(시중은행)
    par 그룹 멤버 병렬 조회 (동시 5개 제한)
        MCP->>API: statisticsInfoSearch(국민은행)
        MCP->>API: statisticsInfoSearch(신한은행)
        MCP->>API: statisticsInfoSearch(...)
    end
    MCP->>MCP: 최빈 기준월로 시점 정합<br/>(불일치 회사는 제외 후 명시)
    MCP->>MCP: 방향 인지 정렬 (NPL은 낮을수록 상위)<br/>평균·중앙값·순위 계산
    MCP-->>AI: 마크다운 테이블 + "단순평균 기준" 주석 + 출처
```

## 내장 프리셋

**전 지표 실API 검증 완료** (2026-07, `verify-presets` + 계정 레벨 실측):

| 권역 | 지표 (listNo/accountCd 확정) |
|------|------|
| 은행 | BIS자기자본비율, 고정이하여신비율(NPL), ROA, ROE, 연체율, 총자산, 당기순이익 |
| 생명보험 | 지급여력비율(K-ICS — '23.3 이전은 RBC 연속 수록), ROA, 13/25회차 계약유지율 |
| 손해보험 | 지급여력비율(K-ICS), ROA |
| 금융투자 | 순자본비율(NCR, '15.03 이후 개별기준), 레버리지비율 |
| 저축은행 | BIS비율, 고정이하여신비율 |
| 여신전문(카드) | 조정자기자본비율, 연체채권비율(1개월 이상) |

실측에서 확인된 도메인 지식 (코드에 반영):
- 지급여력비율은 **경과조치 적용 전** 기준 — 미신청사는 "적용 후" 계정이 0이라 적용 전이 공정 비교
- 은행 **예대율은 FISIS OpenAPI 미제공** (유동성 표는 LCR/NSFR 체제) → 연체율로 대체
- 손보 경과손해율은 IFRS17 전환으로 '22.12 이전 동결 → 미제공
- 금액 통계는 **원 단위** → 응답에서 조/억 자동 변환 (예: 582.9조)

동종그룹: 시중은행 / 지방은행 / 인터넷전문은행 / 주요 생보 10사 / 주요 손보 10사 — `src/domain/peer-groups.ts`에서 편집 가능.

## 사용방법 — 실제 대화 예시

아래 응답들은 문서용 가공이 아니라 **2026-07-13 실API 라이브 출력 그대로**입니다.

### 1) 핵심지표 한 번에 — "삼성생명 최근 지표 보여줘"

에이전트가 `fisis_key_indicators` 를 호출하면:

```markdown
## 삼성생명보험주식회사 핵심 경영지표 — 생명보험 (최근 3개 분기)

| 지표 | 2025Q3 | 2025Q4 | 2026Q1 | 추세 |
|---|---|---|---|---|
| 지급여력비율(K-ICS)(%) | 192.73 | 197.97 | 209.93 | ↗ |
| ROA(%) | 0.75 | 0.58 | 1.43 | ↗ |
| 13회차 계약유지율(%) | - | 88.02 | - |  |
| 25회차 계약유지율(%) | - | 77.24 | - |  |

ℹ️ 13회차 계약유지율은 반기(H) 주기 통계 / ...
출처: 금융감독원 금융통계정보시스템(FISIS)
```

### 2) 벤치마킹 — "카카오뱅크 BIS를 인터넷은행끼리 비교해줘"

`fisis_compare_peers` 응답 (미공표사 제외까지 자동 표기):

```markdown
## BIS자기자본비율 벤치마킹 (2026Q1, 인터넷전문은행)

기준회사: **주식회사 카카오뱅크 22.70%** — 그룹 내 1위/2사, 평균 대비 +0.61%p

| 순위 | 회사 | 값(%) |
|---|---|---|
| 1 | **주식회사 카카오뱅크** | 22.70 |
| 2 | 주식회사 케이뱅크 | 21.47 |

그룹 평균: 22.09% / 중앙값: 22.09%
ℹ️ 단순평균 기준(자산가중 아님) — FISIS 웹의 가중평균과 다를 수 있습니다.
ℹ️ 제외: 토스뱅크 주식회사(미공표) — 그룹 3사 중 2사 기준
출처: 금융감독원 금융통계정보시스템(FISIS)
```

### 3) 제안서용 종합 프로파일 — "KDB생명 대상기관 분석 초안"

`fisis_profile_institution({ company: "KDB생명", focus: "건전성" })` 은
기본정보 + 핵심지표 4분기 + 업권 벤치마킹을 한 번에 반환합니다 (약 1,000자):

```markdown
# 케이디비생명보험주식회사 종합 프로파일
- 권역: 생명보험 / financeCd: 0010607 / 강조 관점: 건전성
...
기준회사: **케이디비생명보험주식회사 74.54%** — 그룹 내 10위/10사, 평균 대비 -103.94%p
```

이 한 줄이 제안서 "대상기관 pain point" 섹션의 근거가 됩니다.

### 4) 프리셋 밖 특수지표 — "저축은행 업종별 기업대출금"

```
fisis_list_statistics(sector="저축은행", keyword="업종별")
→ SE036 대출금 운용(업종별 기업대출금)
fisis_get_statistics(financeCd=..., listNo="SE036", ...)
```

### 다의성 처리

"KB 지표 보여줘"처럼 모호하면 tool이 후보를 반환하고 에이전트가 되묻습니다:

```markdown
'KB' 에 해당하는 회사가 3곳입니다. financeCd를 지정해 다시 호출하세요.
| financeCd | 회사명 | 권역 |
| 0010616 | KB라이프생명보험 | 생명보험 |
| 0010635 | 주식회사KB손해보험 | 손해보험 |
| 0010106 | KB증권주식회사 | 금융투자 |
```

> 💡 회사명은 FISIS 등록명(법인명) 기준입니다. 흔한 별칭(카뱅, KDB생명, SC제일은행,
> 대구은행 등)은 내장 별칭 사전이 자동 해석합니다 — 예: "SC제일은행" → 한국스탠다드차타드은행.

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `FISIS_API_KEY` | (필수) | 인증키 |
| `FISIS_CACHE_DIR` | `~/.fisis-mcp` | 캐시 위치 |
| `FISIS_CACHE_TTL_HOURS` | 24 | 통계 데이터 캐시 (코드류는 30일 고정) |
| `FISIS_MAX_ROWS` | 60 | tool 응답 최대 행 수 (토큰 보호) |
| `FISIS_LANG` | kr | kr / en |

CLI 플래그 `--no-cache`로 캐시 우회.

## 트러블슈팅

| 증상 | 원인/해결 |
|------|-----------|
| "FISIS API 연결 실패 (타임아웃)" | WAF의 UA 필터 — 이 서버는 브라우저 UA 내장으로 해결. 직접 curl 테스트 시에는 `-A "Mozilla/5.0..."` 필요 |
| "인증키가 유효하지 않습니다" | 키 오타 또는 미승인 — fisis.fss.or.kr/page/api-key.jsp에서 상태 확인 |
| "해당 조건의 데이터가 없습니다" | **공표 시차** — FISIS는 분기 종료 후 2~3개월 뒤 공표. 기간을 한 분기 앞으로 |
| "프리셋 갱신 필요" 경고 | 통계표 개편 — `npm run verify-presets` 재실행 후 프리셋 갱신 |
| 특정 회사만 벤치마킹에서 제외됨 | 해당 사 미공표 또는 시점 불일치 — 응답 하단에 사유 명시됨 |
| 값이 FISIS 웹 화면과 다름 | 웹은 **가중평균**, 이 서버는 **단순평균** — 응답에 명시되어 있음 |

## 개발

```bash
npm run build           # tsc 빌드
npm test                # 12개 테스트 (네트워크 불필요 — mock FISIS 봉투로 파이프라인 검증)
npm run inspector       # MCP Inspector로 tool 수동 테스트
npm run verify-presets  # 프리셋 코드 실측 (API 키 + 한국 IP 필요)
```

기여 환영합니다. 특히:
- `verify-presets` 실행 결과로 프리셋 `verified: true` 전환 PR
- 동종그룹 추가 (대형증권사, 캐피탈사 등)
- 권역코드(partDiv/lrgDiv) 실측 보정

## 설계 노트 (왜 이렇게 만들었나)

- **파일 캐시, SQLite 아님** — `npx` 배포에서 네이티브 모듈(better-sqlite3)은 Node 버전별 바이너리 문제의 주범. zero-dependency 파일 캐시로 대체 (수백 항목 수준에선 성능 동일)
- **프리셋 2단 구조** — `verified` 프리셋은 즉시 조회, 미검증은 searchHints로 런타임 동적 탐색. 통계표 개편이 와도 서버가 죽지 않음
- **부분 실패 허용** — 지표 7개 중 1개 실패 시 6개는 정상 반환. composite tool에서 특히 중요
- **에러 = 다음 행동 안내** — 모든 에러는 에이전트가 재시도 전략을 세울 수 있는 문장으로 변환 ("기간을 한 분기 앞으로", "fisis_list_statistics로 탐색" 등)
- **stdout 순결성** — stdio transport에서 stdout은 JSON-RPC 채널. 모든 로그는 stderr

## 라이선스 / 출처

MIT © namojo

데이터 출처: [금융감독원 금융통계정보시스템](https://fisis.fss.or.kr). 모든 tool 응답에 출처가 자동 표기됩니다. FISIS 통계정보 이용 시 출처 명시 의무가 있습니다.
