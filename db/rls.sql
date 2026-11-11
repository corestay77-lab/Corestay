-- OPSIONAL: lapisan kedua isolasi data (Row Level Security).
-- Hanya berlaku bila aplikasi tersambung memakai role database biasa (bukan pemilik tabel dan tanpa BYPASSRLS).
-- Aplikasi harus menjalankan: select set_config('app.tenant_id', '<id tenant>', true) di awal setiap transaksi.
alter table hotels enable row level security;
alter table users enable row level security;
alter table licenses enable row level security;
alter table audit_log enable row level security;
create policy iso_hotels on hotels using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy iso_users on users using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy iso_licenses on licenses using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
create policy iso_audit on audit_log using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
