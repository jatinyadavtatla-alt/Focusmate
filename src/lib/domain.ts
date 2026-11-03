/** Mirrors DnsFilter.normalizeDomain on the Kotlin side. "https://www.Site.com/x" → "site.com"; junk → null. */
export function normalizeDomain(input: string): string | null {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.split(/[/?#]/)[0].split(":")[0];
  d = d.replace(/^www\./, "").replace(/\.+$/, "");
  if (d.length < 3 || !d.includes(".")) return null;
  if (!/^[a-z0-9.-]+$/.test(d) || d.startsWith(".") || d.includes("..")) return null;
  return d;
}
