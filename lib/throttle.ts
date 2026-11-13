import { sql } from "@/lib/db";

// Pembatasan percobaan login: 5 kegagalan untuk satu akun, atau 20 kegagalan dari satu alamat IP, mengunci 15 menit.
let ready: Promise<unknown> | null = null;
const ensure = () => ready || (ready = sql.query("create table if not exists login_throttle(k text primary key, fails int not null default 0, locked_until timestamptz, updated_at timestamptz not null default now())").catch((e) => { ready = null; throw e; }));
export const clientIp = (req: Request) => (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
const keys = (ip: string, acct: string): [string, number][] => [["ip:" + ip, 20], ["acct:" + acct, 5]];

// Mengembalikan sisa detik terkunci (0 bila boleh mencoba).
export async function lockedFor(ip: string, acct: string): Promise<number> {
  await ensure(); let max = 0;
  for (const [k] of keys(ip, acct)) {
    const [r] = await sql.query("select greatest(0, ceil(extract(epoch from (locked_until - now()))))::int as s from login_throttle where k=$1 and locked_until is not null", [k]);
    if (r && r.s > max) max = r.s;
  }
  return max;
}
export async function failLogin(ip: string, acct: string) {
  await ensure();
  for (const [k, limit] of keys(ip, acct))
    await sql.query(
      `insert into login_throttle(k,fails) values($1,1)
       on conflict(k) do update set
         fails = case when login_throttle.locked_until is not null and login_throttle.locked_until <= now() then 1 else login_throttle.fails + 1 end,
         locked_until = case when (case when login_throttle.locked_until is not null and login_throttle.locked_until <= now() then 1 else login_throttle.fails + 1 end) >= $2 then now() + interval '15 minutes' else null end,
         updated_at = now()`, [k, limit]);
}
export async function okLogin(acct: string) { await ensure(); await sql.query("delete from login_throttle where k=$1", ["acct:" + acct]); }
