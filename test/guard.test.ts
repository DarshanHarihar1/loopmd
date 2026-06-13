import { describe, it, expect, vi, afterEach } from "vitest";
import { main } from "../src/guard/guard.js";

describe("placeholder guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits the marker line and exits 0", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(main()).toBe(0);
    expect(log).toHaveBeenCalledWith("loopmd-guard: ok");
  });
});
