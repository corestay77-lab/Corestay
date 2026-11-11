/* eslint-disable @next/next/no-img-element */
'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import { DB, Emp, Calc, rp } from '@/lib/hris/payroll';
import { nowIn } from '@/lib/hris/geo';
const f=(v:number)=>v?Math.round(v).toLocaleString('id-ID'):'—';
const STATUS:Record<string,string>={draft:'DRAFT — belum diajukan',submitted:'DIAJUKAN — menunggu approval',approved:'DISETUJUI — belum dikunci',locked:'FINAL — periode dikunci'};
const SIG=['Disiapkan oleh (HRD)','Diperiksa oleh (Finance)','Disetujui oleh (General Manager)'];
type Col=[string,(c:Calc)=>number];
const EARN:Col[]=[['Gaji pokok',c=>c.basic],['Medical',c=>c.medical],['Makan',c=>c.meal],['Lembur',c=>c.overtime],['Tunjangan lain',c=>c.extraAllow]];
const CUT:Col[]=[['Jamsostek staf',c=>c.jsEmp],['PPh 21',c=>c.pphM],['Potongan absensi',c=>c.manualCut],['Potongan lain',c=>c.extraDed]];
// Laporan Salary per departemen: pratinjau di layar, dicetak / disimpan sebagai PDF lewat dialog cetak browser (pilih "Simpan sebagai PDF").
export default function SalaryReport({db,rows,status,onClose}:{db:DB;rows:{e:Emp;c:Calc}[];status:string;onClose:()=>void}){
  const [hotel,setHotel]=useState(''),ref=useRef<HTMLElement>(null);
  useEffect(()=>{ref.current?.scrollIntoView({behavior:'smooth',block:'start'})},[]);
  const list=rows.filter(r=>!hotel||r.e.hotel===hotel),depts=[...new Set(list.map(r=>r.e.dept||'—'))];
  const S=db.settings,month=new Date(db.period+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'UTC'});
  const sum=(rs:{c:Calc}[],g:(c:Calc)=>number)=>rs.reduce((t,r)=>t+g(r.c),0);
  const net=(c:Calc)=>c.net;
  const printPdf=()=>{const st=document.createElement('style');st.textContent='@page{size:A4 landscape;margin:10mm}';document.head.appendChild(st);
    const done=()=>{st.remove();window.removeEventListener('afterprint',done)};window.addEventListener('afterprint',done);window.print()};
  let no=0;
  const tot=(label:string,rs:{c:Calc}[],bold=true)=><tr style={{background:'#eef3fc',fontWeight:bold?800:600}}><td colSpan={3}>{label}</td>{[...EARN,...CUT].map(([n,g])=><td key={n} style={{textAlign:'right'}}>{f(sum(rs,g))}</td>)}<td style={{textAlign:'right'}}>{f(sum(rs,c=>c.corr))}</td><td style={{textAlign:'right'}}>{f(sum(rs,net))}</td></tr>;
  return <section ref={ref} className="card panel print-area" style={{marginTop:12}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'flex-start'}}>
      <div><img src="/logo.png" alt="" width={110} style={{height:'auto',background:'#0a2a7a',borderRadius:10,padding:6}}/><div style={{fontWeight:800,fontSize:16,marginTop:4}}>{S.company}</div><div className="muted" style={{fontSize:11}}>{[S.address,S.phone,S.npwp&&`NPWP ${S.npwp}`].filter(Boolean).join(' · ')}</div></div>
      <div style={{textAlign:'right'}}><div style={{fontWeight:800,fontSize:18}}>LAPORAN SALARY</div><div>Periode {month}{hotel?` · ${hotel}`:''}</div><div className="muted" style={{fontSize:11}}>Status: {STATUS[status]||status}</div><div className="muted" style={{fontSize:11}}>Dicetak {nowIn(S.tz).date} {nowIn(S.tz).time}</div></div></div>
    <div className="no-print" style={{display:'flex',gap:8,flexWrap:'wrap',margin:'12px 0'}}>
      <select value={hotel} onChange={e=>setHotel(e.target.value)} aria-label="Filter hotel laporan"><option value="">Semua hotel</option>{db.hotels.map(h=><option key={h}>{h}</option>)}</select>
      <button className="button" onClick={printPdf} disabled={!list.length}>Cetak / Simpan PDF</button><button className="button secondary" onClick={onClose}>Tutup preview</button>
      <span className="muted" style={{alignSelf:'center'}}>Di dialog cetak, pilih tujuan &quot;Simpan sebagai PDF&quot;.</span></div>
    <div className="table-wrap"><table><thead>
      <tr><th rowSpan={2}>No</th><th rowSpan={2}>Nama / ID</th><th rowSpan={2}>Jabatan</th><th colSpan={EARN.length}>Pendapatan (Rp)</th><th colSpan={CUT.length}>Potongan (Rp)</th><th rowSpan={2}>Koreksi</th><th rowSpan={2}>Gaji bersih (transfer)</th></tr>
      <tr>{[...EARN,...CUT].map(([n])=><th key={n}>{n}</th>)}</tr></thead><tbody>
      {depts.map(d=>{const rs=list.filter(r=>(r.e.dept||'—')===d);return <Fragment key={d}><tr><td colSpan={3+EARN.length+CUT.length+2} style={{background:'#dbe5f8',fontWeight:800}}>{d} · {rs.length} karyawan</td></tr>
        {rs.map(({e,c})=><tr key={e.id}><td>{++no}</td><td>{e.name}<div className="muted" style={{fontSize:10}}>{e.code||'—'}{e.hotel?` · ${e.hotel}`:''}</div></td><td>{e.position||'—'}</td>
          {[...EARN,...CUT].map(([n,g])=><td key={n} style={{textAlign:'right'}}>{f(g(c))}</td>)}<td style={{textAlign:'right'}}>{f(c.corr)}</td><td style={{textAlign:'right',fontWeight:700}}>{f(c.net)}</td></tr>)}
        {tot('Subtotal '+d,rs,false)}</Fragment>})}
      {list.length?tot('GRAND TOTAL',list):<tr><td colSpan={3+EARN.length+CUT.length+2} className="muted">Belum ada karyawan aktif.</td></tr>}</tbody></table></div>
    <p style={{marginTop:10,fontSize:12}}><b>Total gaji bersih (transfer): {rp(sum(list,net))}</b> · Total biaya perusahaan bulan ini: {rp(sum(list,c=>c.laborCost))} · THR provisi dicadangkan: {rp(sum(list,c=>c.thrProv))} · {list.length} karyawan</p>
    <p className="muted" style={{fontSize:10}}>Pendapatan dibayar = gaji pokok + medical + makan + lembur + tunjangan lain (THR provisi tidak dibayar bulanan). PPh 21 dan Jamsostek staf mengikuti Master Payroll. Gaji bersih = pendapatan − potongan ± koreksi.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginTop:24,textAlign:'center',fontSize:12}}>{SIG.map(x=><div key={x}>{x}<div style={{height:56,borderBottom:'1px solid #333'}}/><div className="muted" style={{fontSize:10,marginTop:2}}>Nama &amp; tanggal</div></div>)}</div>
  </section>}
