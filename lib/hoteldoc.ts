import { sql } from "@/lib/db";
import type { Sess } from "@/lib/auth";

export type H = { id: string; name: string; city: string | null };
// Owner boleh memilih hotel mana pun milik kliennya; GM dan staf hanya hotel yang ditetapkan (atau satu-satunya hotel klien).
export async function resolveHotel(s: Sess, wanted?: string | null): Promise<{ hotel: H | null; hotels: H[] }> {
  const hs = (await sql.query("select id::text as id,name,city from hotels where tenant_id=$1 order by name", [s.tid])) as H[];
  if (s.role === "owner") return { hotel: hs.find((x) => x.id === wanted) || hs[0] || null, hotels: hs };
  const [u] = await sql.query("select hotel_ids from users where id=$1 and tenant_id=$2", [s.uid, s.tid]);
  const mine = ((u?.hotel_ids as string[]) || []).map(String)[0] || (hs.length === 1 ? hs[0].id : null);
  return { hotel: hs.find((x) => x.id === mine) || null, hotels: [] };
}

// Satu dokumen per hotel per aplikasi. Nama tabel hanya dari daftar tetap di bawah (bukan dari masukan pengguna).
const TABLES = ["ops_doc", "crm_doc"] as const;
export function makeStore(table: (typeof TABLES)[number]) {
  if (!TABLES.includes(table)) throw new Error("tabel tidak dikenal");
  let ready: Promise<unknown> | null = null;
  const ensure = () => ready || (ready = sql.query(
    `create table if not exists ${table}(hotel_id uuid primary key references hotels(id) on delete cascade, tenant_id uuid not null references tenants(id) on delete cascade, data jsonb not null, version int not null default 1, updated_at timestamptz not null default now(), updated_by uuid)`
  ).catch((e) => { ready = null; throw e; }));
  return {
    async getDoc(tid: string, hid: string) {
      await ensure();
      const [r] = await sql.query(`select data,version from ${table} where hotel_id=$1 and tenant_id=$2`, [hid, tid]);
      return r ? { data: r.data, version: Number(r.version) } : null;
    },
    async putDoc(tid: string, hid: string, version: number, data: unknown, uid: string): Promise<{ ok: boolean; version?: number }> {
      await ensure();
      if (version === 0) {
        const r = await sql.query(`insert into ${table}(hotel_id,tenant_id,data,version,updated_by) values($1,$2,$3::jsonb,1,$4) on conflict do nothing returning version`, [hid, tid, JSON.stringify(data), uid]);
        return r.length ? { ok: true, version: 1 } : { ok: false };
      }
      const r = await sql.query(`update ${table} set data=$1::jsonb, version=version+1, updated_at=now(), updated_by=$5 where hotel_id=$2 and tenant_id=$3 and version=$4 returning version`, [JSON.stringify(data), hid, tid, version, uid]);
      return r.length ? { ok: true, version: Number(r[0].version) } : { ok: false };
    },
  };
}
