import { describe, expect, it } from "vitest";
import { normalizeName } from "../src/core/resolver.js";

describe("normalizeName", () => {
  it("removes corporate suffixes and whitespace", () => {
    expect(normalizeName("주식회사 국민은행")).toBe("국민은행");
    expect(normalizeName("(주)카카오뱅크")).toBe("카카오뱅크");
    expect(normalizeName("㈜ 케이뱅크")).toBe("케이뱅크");
  });
  it("lowercases latin", () => {
    expect(normalizeName("KB국민은행")).toBe("kb국민은행");
  });
});
