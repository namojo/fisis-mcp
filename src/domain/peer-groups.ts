/**
 * 동종그룹(peer group) 정의.
 * financeCd는 verify-presets 실행 시 회사 캐시에서 이름으로 해석되므로
 * 여기서는 회사명으로 유지한다 (resolver가 런타임에 코드로 변환).
 * 그룹 구성 변경 시 이 파일만 수정하면 된다.
 */
import type { Sector } from "../fisis/types.js";

export interface PeerGroup {
  key: string;
  name: string;
  sector: Sector;
  /** 회사명 (resolver로 financeCd 변환) */
  memberNames: string[];
  aliases: string[];
}

export const PEER_GROUPS: PeerGroup[] = [
  {
    key: "major_commercial_banks",
    name: "시중은행",
    sector: "bank",
    memberNames: ["국민은행", "신한은행", "우리은행", "하나은행", "한국스탠다드차타드은행", "한국씨티은행", "아이엠뱅크"],
    aliases: ["시중은행", "주요은행"],
  },
  {
    key: "regional_banks",
    name: "지방은행",
    sector: "bank",
    memberNames: ["부산은행", "경남은행", "광주은행", "전북은행", "제주은행"],
    aliases: ["지방은행"],
  },
  {
    key: "internet_banks",
    name: "인터넷전문은행",
    sector: "bank",
    memberNames: ["카카오뱅크", "케이뱅크", "토스뱅크"],
    aliases: ["인터넷은행", "인뱅"],
  },
  {
    key: "top_life_insurers",
    name: "주요 생명보험사",
    sector: "insurance_life",
    memberNames: ["삼성생명", "한화생명", "교보생명", "신한라이프", "농협생명보험", "미래에셋생명", "KB라이프생명", "동양생명", "케이디비생명보험", "흥국생명"],
    aliases: ["생보사", "주요생보"],
  },
  {
    key: "top_nonlife_insurers",
    name: "주요 손해보험사",
    sector: "insurance_nonlife",
    memberNames: ["삼성화재", "DB손해보험", "현대해상", "KB손해보험", "메리츠화재", "한화손해보험", "롯데손해보험", "흥국화재", "농협손해보험", "하나손해보험"],
    aliases: ["손보사", "주요손보"],
  },
];

export function resolvePeerGroup(input: string): PeerGroup | null {
  const q = input.trim().toLowerCase();
  return (
    PEER_GROUPS.find((g) => g.key === q) ??
    PEER_GROUPS.find((g) => g.name === input.trim()) ??
    PEER_GROUPS.find((g) => g.aliases.some((a) => a.toLowerCase() === q)) ??
    null
  );
}

export function defaultGroupForSector(sector: Sector): PeerGroup | null {
  return PEER_GROUPS.find((g) => g.sector === sector) ?? null;
}
