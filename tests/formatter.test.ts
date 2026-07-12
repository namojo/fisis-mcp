import { describe, expect, it } from "vitest";
import { baseMonthToLabel, fmtNumber, mean, median, trendArrow, recentQuarterRange } from "../src/core/formatter.js";

describe("formatter", () => {
  it("formats numbers", () => {
    expect(fmtNumber("17.234", "%")).toBe("17.23");
    expect(fmtNumber(1234567)).toBe("1,234,567");
    expect(fmtNumber(null)).toBe("-");
    expect(fmtNumber("")).toBe("-");
  });
  it("labels base months", () => {
    expect(baseMonthToLabel("202603", "Q")).toBe("2026Q1");
    expect(baseMonthToLabel("202512", "Q")).toBe("2025Q4");
    expect(baseMonthToLabel("2025", "Y")).toBe("2025");
    expect(baseMonthToLabel("202506", "H")).toBe("2025H1");
  });
  it("computes trend", () => {
    expect(trendArrow([1, 2, 3])).toBe("↗");
    expect(trendArrow([3, 2])).toBe("↘");
    expect(trendArrow([2, null, 2])).toBe("→");
    expect(trendArrow([5])).toBe("");
  });
  it("stats", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 100])).toBe(2.5);
  });
  it("recent quarter range yields YYYYMM", () => {
    const { start, end } = recentQuarterRange(4);
    expect(start).toMatch(/^\d{6}$/);
    expect(end).toMatch(/^\d{6}$/);
    expect(start < end).toBe(true);
  });
});
