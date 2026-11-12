import { sql } from "@/lib/db";

// Satu dokumen keuangan per klien (tenant). Versi dipakai untuk mencegah dua pengguna saling menimpa.
let ready: Promise<unknown> | null = null;
const ensure = () => ready || (ready = sql.query(
  "create table if not exists fin_doc(tenant_id uuid primary key references tenants(id) on delete cascade, data jsonb not null, version int not null default 1, updated_at timestamptz not null default now(), updated_by uuid)"
).catch((e) => { ready = null; throw e; }));

export async function getDoc(tid: string) {
  await ensure();
  const [r] = await sql.query("select data,version from fin_doc where tenant_id=$1", [tid]);
  return r ? { data: r.data, version: Number(r.version) } : null;
}
export async function putDoc(tid: string, version: number, data: unknown, uid: string): Promise<{ ok: boolean; version?: number }> {
  await ensure();
  if (version === 0) {
    const r = await sql.query("insert into fin_doc(tenant_id,data,version,updated_by) values($1,$2::jsonb,1,$3) on conflict do nothing returning version", [tid, JSON.stringify(data), uid]);
    return r.length ? { ok: true, version: 1 } : { ok: false };
  }
  const r = await sql.query("update fin_doc set data=$1::jsonb, version=version+1, updated_at=now(), updated_by=$4 where tenant_id=$2 and version=$3 returning version", [JSON.stringify(data), tid, version, uid]);
  return r.length ? { ok: true, version: Number(r[0].version) } : { ok: false };
}
