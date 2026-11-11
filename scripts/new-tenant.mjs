// Membuat tabel (bila belum ada) lalu satu klien baru lengkap dengan hotel, pengguna Owner, dan lisensi.
// Sementara Aplikasi Lisensi belum ada, inilah cara mendaftarkan klien.
// Contoh: npm run tenant -- grup-a "Grup A" "Hotel A" "Jakarta" owner PasswordKuat123 finance,crm,ops,hris,budget 365
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';

const [slug, tenant, hotel, city, user, pass, mods = 'finance,crm,ops,hris,budget', days = '365'] = process.argv.slice(2);
if (!slug || !tenant || !hotel || !user || !pass) { console.error('Argumen: slug "Nama klien" "Nama hotel" "Kota" username password [modul,modul] [hari]'); process.exit(1); }
if (pass.length < 10) { console.error('Password minimal 10 karakter.'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL belum diisi di .env.local'); process.exit(1); }
const sql = neon(process.env.DATABASE_URL);
for (const st of readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8').split(';').map(s => s.trim()).filter(Boolean)) await sql.query(st);
const salt = randomBytes(16).toString('hex');
const hash = salt + ':' + scryptSync(pass, salt, 64).toString('hex');
const [t] = await sql.query('insert into tenants(slug,name) values($1,$2) returning id', [slug, tenant]);
const [h] = await sql.query('insert into hotels(tenant_id,name,city) values($1,$2,$3) returning id', [t.id, hotel, city || null]);
await sql.query("insert into users(tenant_id,username,pass_hash,role,hotel_ids) values($1,$2,$3,'owner',$4)", [t.id, user, hash, [h.id]]);
const code = 'CS-' + randomBytes(5).toString('hex').toUpperCase();
const [l] = await sql.query("insert into licenses(tenant_id,code,expires_at) values($1,$2,current_date + $3::int) returning id", [t.id, code, Number(days)]);
for (const m of mods.split(',').map(s => s.trim()).filter(Boolean)) await sql.query('insert into license_modules(license_id,module) values($1,$2)', [l.id, m]);
console.log('Selesai. Kode klien:', slug, '| Username:', user, '| Lisensi:', code, '| Modul:', mods, '| Berlaku', days, 'hari');
