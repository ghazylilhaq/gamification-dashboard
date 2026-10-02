/**
 * Coupons carry no merchant field, so the merchant has to be read out of
 * `name_en`. The spec's rule is "the text before ' Discount' or ' Voucher'",
 * which handles most names but leaves a few messy buckets on the real data:
 * "JD Sports", "JD Sports 100K" and "JD Sports Rp150K" would become three
 * merchants, and "15% Discount in Ismaya+ Merchant" would become "15%".
 *
 * So the spec rule runs first, then a short list of cleanups. Everything that
 * needs a human decision lives in MERCHANT_ALIASES below — that is the one
 * place to edit when new coupons appear.
 */

/** Final say. Matched against the raw name first, then the derived merchant. */
export const MERCHANT_ALIASES: Record<string, string> = {
  // Prizes and memberships that name no merchant of their own.
  '5 Weverse Jelly': 'Weverse',
  'Weverse DM': 'Weverse',
  'Weverse Digital Membership': 'Weverse',
  '1 Session in Strong Pilates': 'Strong Pilates',
  'On Cloudtilt Shoes (JD Sports)': 'JD Sports',
  'Rp100k Court Disc by DOOgether': 'DOOgether',
  'K-Pop Album': 'Merchandise',
  'K-Pop Lightstick': 'Merchandise',
  'Airpods 4': 'Merchandise',
  'iPhone Air 17': 'Merchandise',
  'Trip to South Korea': 'Travel',
  // Derived-value fixes.
  '15%': 'Ismaya+',
};

const AMOUNT_SUFFIX = /\s+(?:Rp\s*)?\d+(?:[.,]\d+)?\s*(?:rb|k|jt|m)?$/i;
const DISCOUNT_IN = /\bdiscount\s+in\s+(.+?)(?:\s+merchant)?$/i;
const BY_SUFFIX = /\bby\s+([A-Za-z0-9+&'’.\- ]+)$/i;
const PARENTHETICAL = /\(([^)]+)\)\s*$/;

/**
 * Derive a merchant name from a coupon's `name_en`.
 * Falls back to the full name when no rule matches, as the spec requires.
 */
export function merchantFromName(rawName: string): string {
  const name = rawName.replace(/\s+/g, ' ').trim();
  if (!name) return 'Unknown';

  const direct = MERCHANT_ALIASES[name];
  if (direct) return direct;

  let merchant: string | null = null;

  // "15% Discount in Ismaya+ Merchant" -> Ismaya+
  const inMatch = name.match(DISCOUNT_IN);
  if (inMatch?.[1]) merchant = inMatch[1];

  // "Aero Bag by Zena" -> Zena
  if (!merchant) {
    const byMatch = name.match(BY_SUFFIX);
    if (byMatch?.[1]) merchant = byMatch[1];
  }

  // "On Cloudtilt Shoes (JD Sports)" -> JD Sports
  if (!merchant) {
    const parenMatch = name.match(PARENTHETICAL);
    if (parenMatch?.[1]) merchant = parenMatch[1];
  }

  // The spec's rule: everything before " Discount" or " Voucher".
  if (!merchant) {
    const idx = findSeparator(name);
    merchant = idx > 0 ? name.slice(0, idx) : name;
  }

  merchant = merchant.replace(/\s+/g, ' ').trim();
  // "JD Sports Rp150K" / "JD Sports 100K" -> JD Sports
  let stripped = merchant.replace(AMOUNT_SUFFIX, '').trim();
  if (stripped === '') stripped = merchant;

  return MERCHANT_ALIASES[stripped] ?? stripped;
}

function findSeparator(name: string): number {
  const lower = name.toLowerCase();
  const candidates = [lower.indexOf(' discount'), lower.indexOf(' voucher')].filter((i) => i > 0);
  return candidates.length ? Math.min(...candidates) : -1;
}
