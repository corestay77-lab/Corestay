/* eslint-disable react-hooks/exhaustive-deps */
'use client';
import { useEffect, useRef, useState } from 'react';
import { useDB, uid, attCells } from '@/lib/hris/store';
import { Emp, Att, recap } from '@/lib/hris/payroll';
import { nowIn } from '@/lib/hris/geo';
// Daftar hadir satu bulan per departemen. Input = "kuas": pilih kode (shift / Libur / Sakit / Izin / Cuti / Alpa), lalu klik atau geser di tanggal.
// Isi sel selalu sinkron dengan absensi: hasil scan karyawan, telat, dan belum pulang tampil di sini, dan angkanya sama dengan Rekap & Payroll. Alpa TIDAK otomatis: hanya yang Anda tandai.
// Jadwal di sini adalah patokan absen karyawan (mode wajib sesuai jadwal): tanpa jadwal / Libur, karyawan tidak bisa absen masuk.
const STAT=['Sakit','Izin','Cuti','Alpa'];
const PAL:Record<string,[string,string]>={Pagi:['#dbeafe','#1e40af'],Siang:['#fef3c7','#92400e'],Malam:['#e0e7ff','#3730a3'],Libur:['#e5e7eb','#4b5563'],Sakit:['#fce7f3','#9d174d'],Izin:['#ede9fe','#5b21b6'],Cuti:['#cffafe','#155e75'],Alpa:['#fee2e2','#b91c1c'],Hadir:['#dcfce7','#166534'],_:['#ccfbf1','#115e59']};
const col=(n:string)=>PAL[n]||PAL._,code=(n:string)=>n==='Hadir'?'Hdr':n.slice(0,3);
const WD=['M','S','S','R','K','J','S'];
export default function MonthlyRoster(){
  const {db,update,locked}=useDB();
  const [dept,setDept]=useState<string|null>(null),[hotel,setHotel]=useState(''),[brushSel,setBrush]=useState<string|null>(null),[err,setErr]=useState(''),[pending,setPending]=useState(0);
  const down=useRef(false),ptype=useRef('mouse');
  useEffect(()=>{const up=()=>{down.current=false};window.addEventListener('pointerup',up);return()=>window.removeEventListener('pointerup',up)},[]);
  const today=nowIn(db.settings.tz).date,[y,m]=db.period.split('-').map(Number),dim=new Date(Date.UTC(y,m,0)).getUTCDate();
  const ds=Array.from({length:dim},(_,i)=>`${db.period}-${String(i+1).padStart(2,'0')}`);
  const month=new Date(db.period+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'UTC'});
  // indeks per (karyawan|tanggal) supaya tabel tetap cepat walau datanya banyak
  const idx=new Map<string,Att[]>();for(const a of db.att){const k=a.empId+'|'+a.date,l=idx.get(k);if(l)l.push(a);else idx.set(k,[a])}
  const sidx=new Map<string,string>();for(const x of db.sched)sidx.set(x.empId+'|'+x.date,x.shift);
  const act=db.emps.filter(e=>e.status==='Aktif'&&(!hotel||e.hotel===hotel));
  const depts=[...new Set([...db.depts,...db.emps.map(e=>e.dept)].filter(Boolean))],cnt=(d:string)=>act.filter(e=>e.dept===d).length;
  const dp=dept!==null?dept:(depts.find(d=>cnt(d)>0)??''),list=act.filter(e=>!dp||e.dept===dp);
  const brushes=[...db.shifts.map(s=>s.name),'Libur',...STAT];
  // kuas awal = shift pertama (atau Libur); null = belum dipilih, '' = Hapus
  const brush=brushSel!==null&&(brushSel===''||brushes.includes(brushSel))?brushSel:(brushes[0]||'');
  // satu sel: gabungan jadwal, input manual, dan hasil scan
  const cell=(e:Emp,d:string)=>{
    const at=idx.get(e.id+'|'+d)||[],manual=at.find(a=>a.src==='manual'&&a.status!=='Hadir'),scan=at.find(a=>a.src!=='manual'&&a.in),sc=sidx.get(e.id+'|'+d);
    const noScan=!manual&&sc!==undefined&&sc!=='Libur'&&d<today&&at.length===0;   // terjadwal, hari sudah lewat, belum ada scan: hanya penanda, BUKAN alpa
    const label=manual?manual.status:sc!==undefined?sc:at.length?'Hadir':'';
    const mark=scan?(scan.lateMin?'#d97706':!scan.out&&d<today?'#dc2626':!scan.out?'#2563eb':'#16a34a'):'';
    const tip=[`${e.name} · ${d}`,label&&(noScan?`${label} — belum ada scan (bukan alpa)`:label),scan&&`Scan ${scan.in}${scan.out?'–'+scan.out:' (belum pulang)'}${scan.lateMin?` · telat ${scan.lateMin} mnt`:''}`].filter(Boolean).join(' · ');
    return {label,noScan,mark,tip,has:!!(manual||sc!==undefined)}};
  const paint=(e:Emp,dates:string[],log?:string)=>{if(locked)return;setErr('');
    const isShift=brush==='Libur'||db.shifts.some(s=>s.name===brush),isStat=STAT.includes(brush);
    update(x=>({...x,sched:[...x.sched.filter(s=>!(s.empId===e.id&&dates.includes(s.date))),...(isShift?dates.map(date=>({id:uid(),empId:e.id,date,shift:brush})):[])]}));
    const hasManual=db.att.some(a=>a.empId===e.id&&dates.includes(a.date)&&a.src==='manual'&&a.status!=='Hadir');
    if(isStat||hasManual){setPending(n=>n+1);attCells(e.id,dates,isStat?brush:'',log).catch(x=>setErr(x.message)).finally(()=>setPending(n=>n-1))}};
  const fillRow=(e:Emp)=>{if(!confirm(`Isi semua tanggal ${month} untuk ${e.name} dengan "${brush}"? Isi yang ada diganti.`))return;paint(e,ds,`Daftar bulanan ${e.name} ${db.period}: isi semua ${brush}`)};
  const noScanCells=list.flatMap(e=>ds.filter(d=>cell(e,d).noScan).map(d=>({e,d})));
  const markAlpa=async()=>{const by=new Map<string,{e:Emp;dates:string[]}>();for(const {e,d} of noScanCells){const g:{e:Emp;dates:string[]}=by.get(e.id)||{e,dates:[] as string[]};g.dates.push(d);by.set(e.id,g)}
    if(!by.size||!confirm(`Tandai ${noScanCells.length} hari terjadwal tanpa scan sebagai ALPA untuk ${by.size} karyawan? Periksa dulu agar tidak salah (mis. sakit/izin yang belum dicatat). Alpa ini memengaruhi saran potongan di Payroll.`))return;
    setErr('');setPending(n=>n+1);try{for(const g of by.values())await attCells(g.e.id,g.dates,'Alpa');update(x=>x,`Tandai ${noScanCells.length} hari tanpa scan sebagai Alpa ${db.period}`)}catch(x:any){setErr(x.message)}finally{setPending(n=>n-1)}};
  const sundays=()=>{const t=ds.filter(d=>new Date(d+'T00:00:00Z').getUTCDay()===0);if(!confirm(`Isi Libur di setiap hari Minggu (${t.length} hari) untuk ${list.length} karyawan? Hanya sel yang masih kosong.`))return;
    update(x=>({...x,sched:[...x.sched,...list.flatMap(e=>t.filter(d=>!x.sched.some(s=>s.empId===e.id&&s.date===d)&&!x.att.some(a=>a.empId===e.id&&a.date===d)).map(date=>({id:uid(),empId:e.id,date,shift:'Libur'})))]}),`Libur tiap Minggu ${db.period}`)};
  const chip=(n:string,on:boolean)=>({background:col(n)[0],color:col(n)[1],border:`2px solid ${on?col(n)[1]:'transparent'}`,borderRadius:999,padding:'6px 14px',fontWeight:700,fontSize:13,cursor:'pointer',boxShadow:on?'0 0 0 3px rgba(10,42,122,.15)':'none'} as React.CSSProperties);
  return <section className="card panel">
    <div className="toolbar"><div><h2>Daftar hadir {month}</h2><p className="muted" style={{margin:0}}>1) Pilih kode di bawah · 2) klik tanggal, atau geser (drag) untuk banyak tanggal. Jadwal ini jadi patokan absen: karyawan hanya bisa absen masuk sesuai shift yang dijadwalkan. Isi sel sinkron dengan absensi karyawan.</p></div>
      <select value={hotel} onChange={e=>setHotel(e.target.value)} aria-label="Filter hotel"><option value="">Semua hotel</option>{db.hotels.map(h=><option key={h}>{h}</option>)}</select></div>
    <div role="tablist" aria-label="Departemen" style={{display:'flex',gap:6,flexWrap:'wrap',margin:'8px 0'}}>
      {[['','Semua',act.length] as [string,string,number],...depts.map(d=>[d,d,cnt(d)] as [string,string,number])].map(([v,l,n])=><button key={l} role="tab" aria-selected={dp===v} onClick={()=>setDept(v)} style={{padding:'6px 12px',borderRadius:10,border:'1px solid #dbe5f8',background:dp===v?'#0a2a7a':'#fff',color:dp===v?'#fff':n?'#0a2a7a':'#9aa8c7',fontWeight:600,fontSize:13,cursor:'pointer'}}>{l} <span style={{opacity:.7}}>({n})</span></button>)}</div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',padding:'10px 12px',background:'#f6f9ff',borderRadius:14,margin:'6px 0 10px'}}>
      <b style={{fontSize:13}}>Kuas:</b>{brushes.map(b=><button key={b} style={chip(b,brush===b)} aria-pressed={brush===b} onClick={()=>setBrush(b)} title={db.shifts.find(s=>s.name===b)?`${b} ${db.shifts.find(s=>s.name===b)!.start}–${db.shifts.find(s=>s.name===b)!.end}`:b}>{b}{db.shifts.find(s=>s.name===b)?` ${db.shifts.find(s=>s.name===b)!.start}`:''}</button>)}
      <button style={{...chip('_',brush==='')}} aria-pressed={brush===''} title="Kuas penghapus: mengosongkan jadwal dan keterangan di tanggal yang diklik (hasil scan tidak ikut terhapus)" onClick={()=>setBrush('')}>🧹 Hapus</button>
      <span className="muted" style={{fontSize:12}}>Aktif: <b>{brush===''?'Hapus':brush}</b></span><span style={{flex:1}}/>{pending>0&&<span className="badge wait" role="status">Menyimpan…</span>}<button className="button secondary" disabled={locked||!noScanCells.length} onClick={markAlpa} title="Tindakan manual: menandai hari terjadwal yang sudah lewat tanpa scan sebagai Alpa">Tandai tanpa scan → Alpa ({noScanCells.length})</button><button className="button secondary" disabled={locked||!list.length} onClick={sundays}>Libur tiap Minggu</button></div>
    {err&&<p role="alert" className="badge bad" style={{whiteSpace:'normal',marginBottom:8}}>{err}</p>}
    <div className="table-wrap"><table style={{borderCollapse:'separate',borderSpacing:2}}><thead><tr>
      <th style={{position:'sticky',left:0,background:'#fff',zIndex:2,minWidth:170,textAlign:'left'}}>Karyawan</th>
      {ds.map(d=>{const wd=new Date(d+'T00:00:00Z').getUTCDay();return <th key={d} style={{padding:'4px 0',minWidth:34,textAlign:'center',color:wd===0?'#dc2626':'#66719a',background:d===today?'#fff3cd':wd===0||wd===6?'#f3f6fd':'transparent',borderRadius:8,fontSize:11}}>{Number(d.slice(8))}<div style={{fontWeight:500}}>{WD[wd]}</div></th>})}
      {['H','T','S','I','C','A'].map(h=><th key={h} title={{H:'Hadir',T:'Telat (kali)',S:'Sakit',I:'Izin',C:'Cuti',A:'Alpa (termasuk otomatis)'}[h]} style={{minWidth:30,textAlign:'center',background:'#eef3fc',borderRadius:8}}>{h}</th>)}</tr></thead><tbody>
      {list.map(e=>{const r=recap(e.id,db);return <tr key={e.id}>
        <td style={{position:'sticky',left:0,background:'#fff',zIndex:1}}><div style={{display:'flex',alignItems:'center',gap:6}}><button className="button secondary" disabled={locked} style={{padding:'2px 8px',fontSize:11}} title={`Isi satu bulan dengan kuas "${brush||'Hapus'}"`} onClick={()=>fillRow(e)}>Isi</button><div><b style={{fontSize:13}}>{e.name}</b><div className="muted" style={{fontSize:10}}>{e.code||'—'}{!dp&&e.dept?` · ${e.dept}`:''}</div></div></div></td>
        {ds.map(d=>{const c=cell(e,d),[bg,fg]=c.label?col(c.label):['#fafbff','#9aa8c7'];
          return <td key={d} title={c.tip} onPointerDown={ev=>{ptype.current=ev.pointerType;if(ev.pointerType==='mouse'){ev.preventDefault();down.current=true;paint(e,[d])}}} onPointerEnter={()=>{if(down.current)paint(e,[d])}} onClick={()=>{if(ptype.current!=='mouse')paint(e,[d])}}
            style={{width:34,height:34,textAlign:'center',borderRadius:9,background:bg,color:fg,fontSize:11,fontWeight:800,cursor:locked?'not-allowed':'pointer',userSelect:'none',position:'relative',outline:d===today?'2px solid #f5b301':'none',boxShadow:c.noScan?'inset 0 0 0 2px #f59e0b':undefined}}>
            {c.label?code(c.label):''}{c.mark&&<span style={{position:'absolute',right:3,bottom:3,width:7,height:7,borderRadius:'50%',background:c.mark,border:'1px solid #fff'}}/>}</td>})}
        {[r.hadir,r.telat,r.sakit,r.izin,r.cuti,r.alpa].map((v,i)=><td key={i} style={{textAlign:'center',fontWeight:700,background:'#eef3fc',borderRadius:8,color:i===5&&v?'#b91c1c':i===1&&v?'#b45309':'#0a2a7a'}}>{v}</td>)}</tr>})}
      {!list.length&&<tr><td className="muted" colSpan={dim+7} style={{padding:16}}>Tidak ada karyawan aktif{dp?` di departemen ${dp}`:''}{hotel?` (${hotel})`:''}. Pilih tab &quot;Semua&quot; atau tambahkan karyawan di Employee Master.</td></tr>}</tbody></table></div>
    <div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:10,fontSize:12,color:'#4b5a82'}}>
      <span><i style={{display:'inline-block',width:9,height:9,borderRadius:'50%',background:'#16a34a'}}/> scan tepat waktu</span><span><i style={{display:'inline-block',width:9,height:9,borderRadius:'50%',background:'#d97706'}}/> scan telat</span><span><i style={{display:'inline-block',width:9,height:9,borderRadius:'50%',background:'#2563eb'}}/> sudah masuk, belum pulang</span><span><i style={{display:'inline-block',width:9,height:9,borderRadius:'50%',background:'#dc2626'}}/> lupa absen pulang</span>
      <span><i style={{display:'inline-block',width:11,height:11,borderRadius:3,boxShadow:'inset 0 0 0 2px #f59e0b'}}/> cincin kuning = terjadwal, hari sudah lewat, belum ada scan (bukan alpa; tandai sendiri bila tidak hadir)</span><span>Hdr = hadir tanpa jadwal (mode jadwal dimatikan / input manual)</span><span>Kolom kanan: H hadir · T telat · S sakit · I izin · C cuti · A alpa — sama dengan Rekap &amp; Payroll</span></div>
  </section>}
