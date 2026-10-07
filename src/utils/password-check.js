// Refuses passwords that already leaked in a data breach, using the free
// "Have I Been Pwned" range API. Only the first 5 characters of the
// password's SHA-1 hash leave the device (k-anonymity): the service never
// sees the password nor its full hash.

const PWNED_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

async function sha1Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** True when the password appears in a known breach. Network trouble = false. */
export async function isPasswordLeaked(password) {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const response = await fetch(PWNED_RANGE_URL + prefix, { headers: { 'Add-Padding': 'true' } });
    if (!response.ok) return false;
    const lines = (await response.text()).split('\n');
    return lines.some(line => {
      const [candidate, count] = line.trim().split(':');
      return candidate === suffix && Number(count) > 0;
    });
  } catch (_) {
    return false;
  }
}
