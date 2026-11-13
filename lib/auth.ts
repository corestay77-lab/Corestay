import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type Sess = { uid: string; tid: string; role: string; name: string; exp: number };
const secret = () => { const s = process.env.SESSION_SECRET; if (!s || s.length < 32) throw new Error("SESSION_SECRET minimal 32 karakter"); return s; };
const mac = (b: string) => createHmac("sha256", secret()).update(b).digest("base64url");

export const hashPassword = (p: string) => { const s = randomBytes(16).toString("hex"); return s + ":" + scryptSync(p, s, 64).toString("hex"); };
export const checkPassword = (p: string, h: string) => {
  const [s, k] = h.split(":"); if (!s || !k) return false;
  const a = Buffer.from(k, "hex"), b = scryptSync(p, s, 64);
  return a.length === b.length && timingSafeEqual(a, b);
};
export const signSession = (s: Sess) => { const b = Buffer.from(JSON.stringify(s)).toString("base64url"); return b + "." + mac(b); };
export const readSession = (t?: string): Sess | null => {
  if (!t) return null; const [b, m] = t.split("."); if (!b || !m) return null;
  const x = Buffer.from(m), y = Buffer.from(mac(b)); if (x.length !== y.length || !timingSafeEqual(x, y)) return null;
  try { const s = JSON.parse(Buffer.from(b, "base64url").toString()) as Sess; return s.exp > Date.now() ? s : null; } catch { return null; }
};
// tenant_id selalu diambil dari sesi di server, tidak pernah dari kiriman browser.
export async function getSession() { return readSession((await cookies()).get("cs")?.value); }

// Token bertanda tangan untuk keperluan lain (sesi admin platform). Dipisah dari sesi klien lewat cookie dan penanda "k".
export const signAny = (o: object) => { const b = Buffer.from(JSON.stringify(o)).toString("base64url"); return b + "." + mac(b); };
export const readAny = (t?: string): Record<string, unknown> | null => {
  if (!t) return null; const [b, m] = t.split("."); if (!b || !m) return null;
  const x = Buffer.from(m), y = Buffer.from(mac(b)); if (x.length !== y.length || !timingSafeEqual(x, y)) return null;
  try { return JSON.parse(Buffer.from(b, "base64url").toString()); } catch { return null; }
};
