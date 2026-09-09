/** Minimal test harness: registration + assertions. No execution here. */
export const cases = [];

export function test(name, fn) {
  cases.push({ name, fn });
}
export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
export function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'not equal'}: got ${fmt(a)}, expected ${fmt(b)}`);
}
export function near(a, b, eps, msg) {
  if (Math.abs(a - b) > (eps ?? 1e-9)) {
    throw new Error(`${msg || 'not near'}: got ${a}, expected ~${b} (eps ${eps})`);
  }
}
function fmt(v) {
  return typeof v === 'string' ? `"${v}"` : String(v);
}
