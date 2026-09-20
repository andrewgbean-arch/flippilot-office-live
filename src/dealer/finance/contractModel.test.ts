import { describe, it, expect } from "vitest";
import {
  CONTRACT_NOTICE_LINES,
  CONTRACT_NOTICE_TITLE,
  CONTRACT_STATUTORY_RIGHTS_LINE,
  contractFigures,
} from "./contractModel";

describe("contract wording", () => {
  const all = [CONTRACT_NOTICE_TITLE, ...CONTRACT_NOTICE_LINES, CONTRACT_STATUTORY_RIGHTS_LINE].join(" ").toLowerCase();

  it("never promises a warranty or an inspection on the dealer's behalf", () => {
    expect(all).not.toContain("3 months");
    expect(all).not.toContain("three months");
    expect(all).not.toContain("is sold with");
    expect(all).not.toContain("inspected the vehicle");
    expect(all).not.toContain("buyer confirms");
  });

  it("the notice says it is a template, not legal advice, and that consumer rights cannot be signed away", () => {
    expect(all).toContain("starting template");
    expect(all).toContain("not legal advice");
    expect(all).toContain("consumer rights act 2015");
    expect(all).toContain("cannot be signed away");
    expect(all).toContain("checked before you use it");
  });

  it("the line printed on the agreement only states the law, it adds no promise", () => {
    expect(CONTRACT_STATUTORY_RIGHTS_LINE).toBe("Nothing in this agreement affects the buyer's statutory rights.");
  });
});

describe("contractFigures", () => {
  it("balance is sale price minus deposit", () => {
    const f = contractFigures("12000", "1500");
    expect(f.salePrice).toBe(12000);
    expect(f.deposit).toBe(1500);
    expect(f.balance).toBe(10500);
    expect(f.depositExceedsPrice).toBe(false);
  });

  it("a blank deposit means none was taken", () => {
    const f = contractFigures(8000, "");
    expect(f.deposit).toBe(0);
    expect(f.balance).toBe(8000);
  });

  it("a blank sale price gives no price and no balance (not a £0.00 sale)", () => {
    const f = contractFigures("", "500");
    expect(f.salePrice).toBeNull();
    expect(f.balance).toBeNull();
    expect(f.depositExceedsPrice).toBe(false);
  });

  it("a deposit bigger than the price is flagged and leaves the balance blank, never negative", () => {
    const f = contractFigures(5000, 6000);
    expect(f.depositExceedsPrice).toBe(true);
    expect(f.balance).toBeNull();
  });

  it("a deposit equal to the price leaves a balance of exactly 0", () => {
    const f = contractFigures(5000, 5000);
    expect(f.depositExceedsPrice).toBe(false);
    expect(f.balance).toBe(0);
  });

  it("garbage and negative entries count as missing", () => {
    expect(contractFigures("abc", "x").salePrice).toBeNull();
    expect(contractFigures(-100, 0).salePrice).toBeNull();
    expect(contractFigures(1000, -50).deposit).toBe(0);
  });
});
