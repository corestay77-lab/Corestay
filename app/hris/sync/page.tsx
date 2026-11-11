'use client';
import Shell from '@/components/hris/Shell';
import { useState } from 'react';
import Link from 'next/link';
import { useDB, uid } from '@/lib/hris/store';
import { calc, normKey } from '@/lib/hris/payroll';
import { Parsed, parseDraft, parseSheet, planMaster, applyMaster } from '@/lib/hris/budgetSync';
const f=(v:number)=>Math.round(v).toLocaleString('id-ID');
export default function Sync(){
  const {db,update}=useDB();
  const [P,setP]=useState<Parsed|null>(null),[hotel,setHotel]=useState(''),[fname,setFname]=useState(''),[err,setErr]=useState(''),[done,setDone]=useState('');
  const plan=P?planMaster(db,hotel,P):null;
  // Baca file hasil unduhan Hotel Budget: Draft (.json) atau Excel (.xlsx)
  const readBudget=async(file?:File)=>{if(!file)return;setErr('');setDone('');setP(null);setFname(file.name);
    try{let parsed:Parsed|null=null;
      if(/\.(xlsx|xls)$/i.test(file.name)){const XLSX=await import('xlsx'),wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
        const names=[...wb.SheetNames].sort((a,b)=>(a==='Payroll & Expenses'?-1:0)-(b==='Payroll & Expenses'?-1:0));
        for(const n of names){parsed=parseSheet(XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:null}) as any[][]);if(parsed)break}
        if(!parsed)throw new Error('Sheet Master Payroll tidak ditemukan. Pakai file Excel yang diunduh dari Hotel Budget (sheet "Payroll & Expenses"), atau file Draft (.json).')}
      else{let j:any;try{j=JSON.parse(await file.text())}catch{throw new Error('File tidak bisa dibaca. Pakai file Draft (.json) atau Excel (.xlsx) dari Hotel Budget.')}
        parsed=parseDraft(j);if(!parsed)throw new Error('Bukan file Draft Hotel Budget CoreStay (format corestay-hotel-budget-draft). Unduh ulang lewat tombol simpan draft di Hotel Budget.')}
      if(!parsed.rows.length)throw new Error('Tidak ada baris Master Payroll yang terisi (jumlah staf dan gaji pokok) di file ini.');
      setP(parsed);setHotel(db.hotels.find(h=>normKey(h)===normKey(parsed!.hotelName))||(db.hotels.length===1?db.hotels[0]:''))}
    catch(e:any){setErr(e.message)}};
  const apply=()=>{if(!P||!plan)return;update(d=>({...d,master:applyMaster(d,hotel,P,uid),lastSync:new Date().toISOString()}),`Sinkron Master Payroll dari Hotel Budget${hotel?` (${hotel})`:''}: ${plan.add} baru, ${plan.upd} diperbarui`);setDone(`Selesai: ${plan.add} posisi baru, ${plan.upd} diperbarui, ${plan.same} tidak berubah.`);setP(null)};
  const exp=()=>{const data={period:db.period,laborCost:Object.fromEntries(db.depts.map(d=>[d,Math.round(db.emps.filter(e=>e.dept===d&&e.status==='Aktif').reduce((s,e)=>s+calc(e,db).laborCost,0))]))};
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.download=`people-to-budget-${db.period}.json`;a.click();update(d=>({...d,lastSync:new Date().toISOString()}),`Ekspor labor cost ${db.period} untuk CoreStay Budget`)};
  const imp=async(f?:File)=>{if(!f)return;try{const j=JSON.parse(await f.text()),b:Record<string,number>={};for(const d of db.depts)if(typeof j[d]==='number')b[d]=j[d];update(d=>({...d,budget:{...d.budget,...b},lastSync:new Date().toISOString()}),`Impor budget (${Object.keys(b).length} departemen)`)}catch{alert('File JSON tidak valid. Format: {"Front Office":50000000,…}')}};
  return <Shell title="Integrasi · CoreStay Sync" sub="Pertukaran data dengan CoreStay Hotel Budget lewat file (belum ada koneksi API langsung).">
    <section className="card panel" style={{marginBottom:12}}><h2>Sinkronisasi Master Payroll dari Hotel Budget</h2>
      <p className="muted">Di Hotel Budget, unduh <b>Draft (.json)</b> (disarankan, memuat PTKP) atau <b>Excel (.xlsx)</b> (PTKP tidak ada di file ini), lalu pilih file di sini. Isinya masuk ke tabel Master Payroll di menu Payroll. Baris yang sama (hotel + departemen + jabatan) diperbarui, bukan digandakan; baris yang tidak ada di file tidak dihapus.</p>
      <input type="file" accept=".json,.xlsx,.xls,application/json" onChange={e=>{readBudget(e.target.files?.[0]);e.target.value=''}} aria-label="File dari Hotel Budget"/>
      {err&&<p role="alert" className="badge bad" style={{whiteSpace:'normal',marginTop:10}}>{err}</p>}
      {done&&<p role="status" className="badge ok" style={{whiteSpace:'normal',marginTop:10}}>{done} <Link href="/hris/payroll">Lihat Master Payroll →</Link></p>}
      {P&&plan&&<div style={{marginTop:12}}><p><b>{fname}</b> · sumber {P.source==='draft'?'Draft JSON':'Excel'}{P.hotelName?` · hotel "${P.hotelName}"`:''}{P.period?` · periode ${P.period}`:''} · {P.rows.length} posisi{P.skipped?` (${P.skipped} baris kosong dilewati)`:''}</p>
        <div className="field" style={{maxWidth:360}}><label>Masukkan ke hotel</label><select value={hotel} onChange={e=>setHotel(e.target.value)}><option value="">Semua hotel</option>{db.hotels.map(h=><option key={h}>{h}</option>)}</select></div>
        <div className="table-wrap"><table><thead><tr><th>Status</th><th>Dept</th><th>Jabatan</th><th>Jumlah staf</th><th>Gaji pokok</th><th>Medical</th><th>Makan</th><th>PTKP</th><th>Asuransi</th><th>Biaya lain</th></tr></thead><tbody>
          {plan.items.map((it,i)=><tr key={i}><td><span className={`badge ${!it.match?'ok':it.changed?'wait':''}`}>{!it.match?'Baru':it.changed?'Diperbarui':'Sama'}</span></td><td>{it.row.dept}</td><td>{it.row.position||'—'}</td><td>{it.row.headcount}</td><td>{f(it.row.basic)}</td><td>{it.row.medical?f(it.row.medical):'—'}</td><td>{it.row.meal?f(it.row.meal):'—'}</td><td>{it.row.ptkp?f(it.row.ptkp):'—'}</td><td>{it.row.insurance?f(it.row.insurance):'—'}</td><td>{it.row.other?f(it.row.other):'—'}</td></tr>)}</tbody></table></div>
        <p className="muted">{plan.add} baru · {plan.upd} diperbarui · {plan.same} sama{plan.missing?` · ${plan.missing} posisi di Master Payroll tidak ada di file (dibiarkan)`:''}. {P.source==='xlsx'?'Nilai Excel adalah total per baris; sudah dibagi jumlah staf menjadi per orang. PTKP lama dipertahankan.':'PTKP dari file hanya mengganti PTKP posisi yang sudah ada bila file memuatnya.'}</p>
        <div style={{display:'flex',gap:8}}><button className="button" disabled={!plan.add&&!plan.upd} onClick={apply}>Terapkan sinkronisasi</button><button className="button secondary" onClick={()=>setP(null)}>Batal</button></div></div>}</section>
    <section className="grid"><article className="card panel"><h2>Ekspor ke Budget</h2><p className="muted">Aktual labor cost per departemen periode {db.period}.</p><button className="button" onClick={exp}>Unduh JSON</button></article>
      <article className="card panel"><h2>Impor budget dari Budget</h2><p className="muted">JSON {'{"Departemen": nilai}'} mengisi kolom budget di Labor Cost Control.</p><input type="file" accept="application/json" onChange={e=>imp(e.target.files?.[0])}/></article></section>
    <p className="muted" style={{marginTop:12}}>Sinkron terakhir: {db.lastSync?new Date(db.lastSync).toLocaleString('id-ID'):'belum pernah'}</p></Shell>}
