'use client';
import { useState } from 'react';
import { api, refreshGate } from '@/lib/hris/store';
// Buat/perbarui database, download backup, dan restore.
export default function DatabaseCard(){
  const [busy,setBusy]=useState(false),[msg,setMsg]=useState<{t:string;ok:boolean}|null>(null);
  const run=async(f:()=>Promise<string>)=>{setBusy(true);setMsg(null);try{setMsg({t:await f(),ok:true})}catch(e:any){setMsg({t:e.message,ok:false})}setBusy(false)};
  const create=()=>run(async()=>{await api('/api/hris/setup',{method:'POST',body:'{}'});return 'Database siap. Semua tabel sudah ada dan terbaru.'});
  const download=()=>run(async()=>{const r=await fetch('/api/hris/backup',{cache:'no-store'});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'Gagal mengunduh');
    const a=document.createElement('a');a.href=URL.createObjectURL(await r.blob());a.download=`corestay-people-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();return 'Backup diunduh. Simpan file ini di tempat aman (berisi data gaji).'});
  const restore=(f?:File)=>{if(!f)return;run(async()=>{
    let j:any;try{j=JSON.parse(await f.text())}catch{throw new Error('File backup tidak valid')}
    if(!confirm('Pulihkan backup? SELURUH data SEMUA HOTEL (karyawan, gaji, absensi) akan diganti dengan isi file ini. Lanjutkan?'))return 'Dibatalkan.';
    const r=await api('/api/hris/backup',{method:'POST',body:JSON.stringify(j)});await refreshGate();return `Backup dipulihkan: ${r.hotels} hotel, ${r.emps} karyawan, ${r.att} data absensi.${r.note||''}`})};
  return <section className="card panel"><h2>Database & Backup</h2>
    <p className="muted">Database dari Vercel → Storage (sudah terhubung). Tombol Buat database aman dijalankan berulang: hanya membuat tabel yang belum ada.</p>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
      <button className="button" disabled={busy} onClick={create}>Buat / perbarui database</button>
      <button className="button secondary" disabled={busy} onClick={download}>Download backup</button>
      <label className="button secondary" style={{cursor:busy?'not-allowed':'pointer'}}>Restore backup<input type="file" accept="application/json" hidden disabled={busy} onChange={e=>{restore(e.target.files?.[0]);e.target.value=''}}/></label></div>
    {msg&&<p role="status" className={`badge ${msg.ok?'ok':'bad'}`} style={{whiteSpace:'normal',marginTop:10}}>{msg.t}</p>}
    <p className="muted">Restore menerima file backup baru maupun backup lama dari versi yang menyimpan data di browser (dipakai untuk memindahkan data lama ke database). Ukuran file maks ± 4 MB.</p></section>}
