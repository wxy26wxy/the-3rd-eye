import { describe, expect, it } from "vitest";
import { checkAdminAuth } from "./admin-auth";

const basic = (userPass: string) => `Basic ${btoa(userPass)}`;

describe("checkAdminAuth", () => {
  it.each([
    ["no header", null, "pw", "unauthorized"],
    ["right password", basic("x:pw"), "pw", "ok"],
    ["any username", basic("admin:pw"), "pw", "ok"],
    ["wrong case", basic("x:pW"), "pw", "unauthorized"],
    ["wrong password", basic("x:pw2"), "pw", "unauthorized"],
    ["no colon", basic("nocolon"), "pw", "unauthorized"],
    ["bad base64", "Basic !!!", "pw", "unauthorized"],
    ["bearer scheme", "Bearer pw", "pw", "unauthorized"],
    ["password containing a colon", basic("x:a:b"), "a:b", "ok"],
    ["password unset", basic("x:pw"), undefined, "disabled"],
    ["password empty", basic("x:pw"), "", "disabled"],
  ] as const)("%s", (_name, header, password, expected) => {
    expect(checkAdminAuth(header, password)).toBe(expected);
  });

  it("reads ADMIN_PASSWORD from the environment by default", () => {
    const prev = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = "envpw";
    try {
      expect(checkAdminAuth(basic("x:envpw"))).toBe("ok");
      expect(checkAdminAuth(basic("x:nope"))).toBe("unauthorized");
    } finally {
      if (prev === undefined) delete process.env.ADMIN_PASSWORD;
      else process.env.ADMIN_PASSWORD = prev;
    }
  });
});
