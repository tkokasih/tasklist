import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDuration, formatTimestamp } from "./time";

describe("time formatting helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("formatDuration", () => {
    it("formats durations with hours when needed", () => {
      expect(formatDuration(3_781_000)).toBe("1:03:01");
    });

    it("pads minutes and seconds for sub-hour durations", () => {
      expect(formatDuration(125_000)).toBe("02:05");
    });

    it("clamps negative durations to zero", () => {
      expect(formatDuration(-2_000)).toBe("00:00");
    });
  });

  describe("formatTimestamp", () => {
    it("returns empty string when iso is missing", () => {
      expect(formatTimestamp(undefined)).toBe("");
    });

    it("falls back to raw value for invalid dates", () => {
      expect(formatTimestamp("not-a-date")).toBe("not-a-date");
    });

    it("formats valid iso timestamps using locale formatting", () => {
      const spy = vi
        .spyOn(Date.prototype, "toLocaleString")
        .mockReturnValue("Mock Locale Time");

      expect(formatTimestamp("2024-01-01T10:00:00.000Z")).toBe(
        "Mock Locale Time",
      );
      expect(spy).toHaveBeenCalled();
    });
  });
});
