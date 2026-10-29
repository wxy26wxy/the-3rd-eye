import { describe, expect, it } from "vitest";
import { safeErrorText } from "./log-safe";

describe("safeErrorText", () => {
  it("drops query params, which can hold a login code", () => {
    const err = new Error('Failed query: select * from "creators" where "login_code" = $1\nparams: K7M2PQRS9T', { cause: { code: "23505" } });
    const text = safeErrorText(err);
    expect(text).not.toContain("K7M2PQRS9T");
    expect(text).toContain("params: [redacted]");
    expect(text).toContain("23505");
  });
  it("keeps ordinary messages", () => {
    expect(safeErrorText(new Error("boom"))).toBe("Error: boom");
    expect(safeErrorText("plain")).toBe("plain");
  });
});
