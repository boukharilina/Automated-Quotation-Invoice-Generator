// All money is handled in millimes (integers) to avoid floating point errors. 1 TND = 1000 millimes.
export const toM = (tnd: number | string): number => Math.round(Number(tnd) * 1000);
export const fromM = (m: number): number => m / 1000;

export interface LineInput { quantity: number; unit_price: number }
export interface Totals {
  subtotal_ht: number; discount: number; extra_charges: number;
  total_ht: number; vat_rate: number; vat_amount: number; total_ttc: number;
}

/** Prix HT (TND, 3 décimales) à partir d'un prix TTC : TTC / (1 + TVA). 3500 @19 % -> 2941.176 */
export const htFromTtc = (ttc: number | string, vatRate: number): number => fromM(Math.round((toM(ttc) * 100) / (100 + vatRate)));

/** Line total HT in TND. */
export const lineTotal = (l: LineInput) => fromM(Math.round(l.quantity * toM(l.unit_price)));

export function computeTotals(lines: LineInput[], discount: number, extra: number, vatRate: number): Totals {
  const sub = lines.reduce((s, l) => s + Math.round(l.quantity * toM(l.unit_price)), 0);
  const d = toM(discount), e = toM(extra);
  const net = Math.max(0, sub - d + e);
  // TVA arrondie au millime supérieur : un prix TTC converti en HT (ex. 3500 -> 2 941,176) redonne exactement le TTC d'origine.
  const vat = Math.ceil((net * vatRate) / 100 - 1e-9);
  return {
    subtotal_ht: fromM(sub), discount: fromM(d), extra_charges: fromM(e),
    total_ht: fromM(net), vat_rate: vatRate, vat_amount: fromM(vat), total_ttc: fromM(net + vat),
  };
}

/** "4 165,000 TND" — plain ASCII spaces so the standard PDF fonts can render it. */
export function fmt(n: number, withCurrency = true): string {
  const m = Math.round(Number(n) * 1000);
  const neg = m < 0; const a = Math.abs(m);
  const int = Math.floor(a / 1000).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const dec = (a % 1000).toString().padStart(3, "0");
  return `${neg ? "-" : ""}${int},${dec}${withCurrency ? " TND" : ""}`;
}

const U = ["zéro","un","deux","trois","quatre","cinq","six","sept","huit","neuf","dix","onze","douze","treize","quatorze","quinze","seize","dix-sept","dix-huit","dix-neuf"];
const T = ["","","vingt","trente","quarante","cinquante","soixante"];
function below100(n: number): string {
  if (n < 20) return U[n];
  if (n < 70) { const t = Math.floor(n / 10), u = n % 10; return T[t] + (u === 1 ? " et un" : u ? "-" + U[u] : ""); }
  if (n < 80) { const r = n - 60; return "soixante" + (r === 11 ? " et onze" : "-" + U[r]); }
  const r = n - 80; return r === 0 ? "quatre-vingts" : "quatre-vingt-" + U[r];
}
function below1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  let s = "";
  if (h) s = (h === 1 ? "cent" : U[h] + " cent") + (r === 0 && h > 1 ? "s" : "");
  if (r) s += (s ? " " : "") + below100(r);
  return s;
}
export function numberToFrench(n: number): string {
  if (n === 0) return "zéro";
  const parts: string[] = [];
  const mil = Math.floor(n / 1_000_000), th = Math.floor((n % 1_000_000) / 1000), r = n % 1000;
  if (mil) parts.push(below1000(mil) + (mil > 1 ? " millions" : " million"));
  if (th) parts.push(th === 1 ? "mille" : below1000(th).replace(/cents$/, "cent") + " mille");
  if (r) parts.push(below1000(r));
  return parts.join(" ");
}
/** 4165 -> "quatre mille cent soixante-cinq dinars" (+ millimes when present). */
export function amountInWords(amount: number): string {
  const m = Math.round(amount * 1000);
  const d = Math.floor(m / 1000), mm = m % 1000;
  let s = `${numberToFrench(d)} dinar${d > 1 ? "s" : ""}`;
  if (mm) s += ` et ${numberToFrench(mm)} millime${mm > 1 ? "s" : ""}`;
  return s;
}
