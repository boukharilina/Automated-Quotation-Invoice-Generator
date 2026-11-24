import { describe, expect, it } from "vitest";
import { computeTotals, fmt, amountInWords, htFromTtc } from "./money";

describe("TTC -> HT", () => {
  it("3500 TTC -> 2941,176 HT -> 3500 TTC", () => {
    expect(htFromTtc(3500, 19)).toBe(2941.176);
    const t = computeTotals([{ quantity: 1, unit_price: htFromTtc(3500, 19) }], 0, 0, 19);
    expect(t.vat_amount).toBe(558.824); expect(t.total_ttc).toBe(3500);
  });
  it("1000 TTC -> 840,336 HT -> 1000 TTC", () => {
    expect(htFromTtc(1000, 19)).toBe(840.336);
    expect(computeTotals([{ quantity: 1, unit_price: htFromTtc(1000, 19) }], 0, 0, 19).total_ttc).toBe(1000);
  });
});

describe("totals", () => {
  it("default service: 3500 HT -> 665 TVA -> 4165 TTC", () => {
    const t = computeTotals([{ quantity: 1, unit_price: 3500 }], 0, 0, 19);
    expect(t.total_ht).toBe(3500); expect(t.vat_amount).toBe(665); expect(t.total_ttc).toBe(4165);
  });
  it("applies discount and charges before VAT", () => {
    const t = computeTotals([{ quantity: 2, unit_price: 100.5 }], 21, 10, 19);
    expect(t.subtotal_ht).toBe(201); expect(t.total_ht).toBe(190); expect(t.vat_amount).toBe(36.1); expect(t.total_ttc).toBe(226.1);
  });
  it("never goes negative", () => {
    expect(computeTotals([{ quantity: 1, unit_price: 10 }], 50, 0, 19).total_ttc).toBe(0);
  });
});
describe("format", () => {
  it("formats TND", () => { expect(fmt(4165)).toBe("4 165,000 TND"); expect(fmt(2165.5, false)).toBe("2 165,500"); });
  it("writes amounts in French", () => {
    expect(amountInWords(4165)).toBe("quatre mille cent soixante-cinq dinars");
    expect(amountInWords(3500)).toBe("trois mille cinq cents dinars");
    expect(amountInWords(81.5)).toBe("quatre-vingt-un dinars et cinq cents millimes");
    expect(amountInWords(1)).toBe("un dinar");
  });
});
