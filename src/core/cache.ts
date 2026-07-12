/**
 * 파일 기반 JSON 캐시.
 *
 * 설계 노트: 스펙 v1은 better-sqlite3였으나, npx 배포 시 네이티브 모듈의
 * Node 버전별 바이너리 문제가 실사용 최대 장애 요인이라 zero-dependency
 * 파일 캐시로 변경. 항목 수가 수백 개 수준이라 성능 차이는 무의미.
 *
 * 구조: {cacheDir}/cache/{sha256(key)}.json
 *       { key, fetchedAt, ttlHours, payload }
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const TTL_CODES_HOURS = 24 * 30; // 회사·통계표·계정 코드: 30일
const TTL_DATA_HOURS = Number(process.env.FISIS_CACHE_TTL_HOURS ?? 24); // 통계 데이터: 24시간

interface Entry<T> {
  key: string;
  fetchedAt: number;
  ttlHours: number;
  payload: T;
}

export class FileCache {
  private dir: string;
  private disabled: boolean;

  constructor() {
    const base = process.env.FISIS_CACHE_DIR ?? join(homedir(), ".fisis-mcp");
    this.dir = join(base, "cache");
    this.disabled = process.argv.includes("--no-cache");
    try {
      mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    } catch {
      this.disabled = true; // 캐시 불가 환경이어도 서버는 동작해야 함
    }
  }

  private pathFor(key: string): string {
    const h = createHash("sha256").update(key).digest("hex").slice(0, 32);
    return join(this.dir, `${h}.json`);
  }

  get<T>(key: string): T | null {
    if (this.disabled) return null;
    const p = this.pathFor(key);
    if (!existsSync(p)) return null;
    try {
      const e = JSON.parse(readFileSync(p, "utf-8")) as Entry<T>;
      const ageHours = (Date.now() - e.fetchedAt) / 3_600_000;
      if (ageHours > e.ttlHours) {
        unlinkSync(p); // lazy sweep
        return null;
      }
      return e.payload;
    } catch {
      return null;
    }
  }

  set<T>(key: string, payload: T, kind: "codes" | "data"): void {
    if (this.disabled) return;
    const e: Entry<T> = {
      key,
      fetchedAt: Date.now(),
      ttlHours: kind === "codes" ? TTL_CODES_HOURS : TTL_DATA_HOURS,
      payload,
    };
    try {
      writeFileSync(this.pathFor(key), JSON.stringify(e), { mode: 0o600 });
    } catch {
      /* 캐시 실패는 무시 — 기능에 영향 없음 */
    }
  }
}

export const cache = new FileCache();
