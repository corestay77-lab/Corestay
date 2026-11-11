'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users,CalendarCheck,TriangleAlert,Wallet,ChartColumn,PieChart,ClipboardList,Clock,History,Calendar,ChevronLeft,ChevronRight,QrCode } from 'lucide-react';
import Shell from '@/components/hris/Shell';
import { useDB, newToken } from '@/lib/hris/store';
import QrSvg from '@/components/hris/QrSvg';
import HotelQr from '@/components/hris/HotelQr';
import { calc, rp } from '@/lib/hris/payroll';
import { nowIn } from '@/lib/hris/geo';
const COL=['#1d5bff','#3b9bff','#7b3fe4','#13b8aa','#d9b45a','#ff7a59','#8aa4d6'];
const monthAdd=(p:string,i:number)=>{const[y,m]=p.split('-').map(Number);return new Date(Date.UTC(y,m-1+i,1)).toISOString().slice(0,7)};
const mLabel=(p:string)=>new Date(p+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'short',timeZone:'UTC'});
const Hero=()=><svg viewBox="0 0 600 180" preserveAspectRatio="xMaxYMax slice" aria-hidden><defs><linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9b45a" stopOpacity=".9"/><stop offset="1" stopColor="#d9b45a" stopOpacity="0"/></linearGradient></defs>
  <circle cx="470" cy="60" r="38" fill="url(#sun)"/><g fill="#ffffff" fillOpacity=".14"><rect x="300" y="70" width="46" height="110"/><rect x="352" y="45" width="56" height="135"/><rect x="414" y="85" width="50" height="95"/><rect x="470" y="60" width="62" height="120"/><rect x="538" y="95" width="62" height="85"/></g>
  <g stroke="#ffffff" strokeOpacity=".35" strokeWidth="2">{[0,1,2,3,4,5].map(i=><line key={i} x1="356" x2="404" y1={62+i*16} y2={62+i*16}/>)}{[0,1,2,3,4].map(i=><line key={i} x1="476" x2="526" y1={78+i*18} y2={78+i*18}/>)}</g>
  <path d="M0 150 Q150 125 300 150 T600 145 V180 H0Z" fill="#fff" fillOpacity=".12"/><path d="M0 165 Q150 148 300 165 T600 160 V180 H0Z" fill="#fff" fillOpacity=".18"/></svg>;
export default function Home(){
  const {db,update,status}=useDB(),today=nowIn(db.settings.tz).date,P=db.period;
  // QR absen hotel yang sedang aktif (login hotel = hotelnya sendiri; admin = hotel yang dipilih di atas)
  const hotel=db.hotels[0]||'',tok=db.geo[hotel]?.qr||'',hasGeo=!!(db.geo[hotel]?.lat||db.geo[hotel]?.lng);
  const [base,setBase]=useState(''),[poster,setPoster]=useState(false),[copied,setCopied]=useState(false);useEffect(()=>setBase(location.origin),[]);
  const qrUrl=`${base}/absen?q=${tok}`,regen=()=>update(d=>({...d,geo:{...d.geo,[hotel]:{lat:0,lng:0,radius:d.settings.radius,shift:d.settings.shift,tz:d.settings.tz,...(d.geo[hotel] as object|undefined),qr:newToken()} as typeof d.geo[string]}}),`Kode QR ${hotel} dibuat/diganti`);
  const copyUrl=async()=>{try{await navigator.clipboard.writeText(qrUrl);setCopied(true);setTimeout(()=>setCopied(false),1500)}catch{}};
  const act=db.emps.filter(e=>e.status==='Aktif');
  const todayAtt=db.att.filter(a=>a.date===today);
  const cnt=(f:(a:typeof todayAtt[0])=>boolean)=>todayAtt.filter(f).length;
  const A=[['Hadir',cnt(a=>a.status==='Hadir'&&!a.late),'#13b8aa'],['Terlambat',cnt(a=>!!a.late),'#ff9c2f'],['Sakit',cnt(a=>a.status==='Sakit'),'#3b9bff'],['Izin',cnt(a=>a.status==='Izin'),'#1d5bff'],['Cuti',cnt(a=>a.status==='Cuti'),'#7b3fe4'],['Tanpa Keterangan',cnt(a=>a.status==='Alpa'),'#ff3b5c']] as [string,number,string][];
  const aTot=todayAtt.length,present=A[0][1]+A[1][1];
  const pending=db.att.filter(a=>a.in&&!a.out&&a.date<today).length; // masuk tanpa absen pulang
  const submitted=Object.values(db.periods).filter(s=>s==='submitted').length;
  const net=act.reduce((s,e)=>s+calc(e,db).net,0);
  const K=[[Users,'Karyawan Aktif',String(act.length),`${db.hotels.length} hotel · ${db.depts.length} departemen`,'b-blue'],[CalendarCheck,'Kehadiran Hari Ini',aTot?Math.round(present/aTot*100)+'%':'—',aTot?`${present} dari ${aTot} tercatat`:'Belum ada absensi hari ini','b-teal'],[TriangleAlert,'Lupa Absen Pulang',String(pending),'Masuk tanpa absen pulang','b-orange'],[Wallet,'Payroll Menunggu Approval',String(submitted),`Periode ${P}: ${rp(net)}`,'b-purple']] as const;
  // tren 6 bulan
  const ms=[-5,-4,-3,-2,-1,0].map(i=>monthAdd(P,i));
  const T=ms.map(m=>{const l=act.filter(e=>!e.joinDate||e.joinDate.slice(0,7)<=m);return{m,n:l.length,c:l.reduce((s,e)=>s+calc(e,{...db,period:m}).laborCost,0)/1e6}});
  const mx=Math.max(5,Math.ceil(Math.max(...T.map(t=>t.n))/5)*5),mc=Math.max(1,...T.map(t=>t.c)),W=560,H=230,pl=34,pr=34,pt=14,pb=30,sl=(W-pl-pr)/6;
  const yb=(v:number)=>H-pb-v/mx*(H-pb-pt),yc=(v:number)=>H-pb-v/mc*(H-pb-pt),xc=(i:number)=>pl+sl*i+sl/2;
  // komposisi
  const byDept=db.depts.map(d=>[d,act.filter(e=>e.dept===d).length] as [string,number]).filter(x=>x[1]>0),C=2*Math.PI*54;let acc=0;
  // payroll status
  const per=[...new Set([...Object.keys(db.periods),P])].sort().reverse().slice(0,5);
  const sb=(s:string)=>s==='locked'?['Terkunci','lock']:s==='approved'?['Disetujui','ok']:s==='submitted'?['Menunggu Approval','wait']:['Draft',''];
  const tasks=[['Rekap absensi',`${pending} lupa absen pulang`,pending,'/hris/attendance'],['Payroll approval','Menunggu pemeriksaan/approval',submitted,'/hris/approval'],['Payroll Correction',`${db.corr.filter(c=>c.period===P).length} koreksi periode ini`,db.corr.filter(c=>c.period===P).length,'/hris/correction'],['CoreStay Sync',db.lastSync?'Terakhir '+new Date(db.lastSync).toLocaleDateString('id-ID'):'Belum pernah sinkron',db.lastSync?0:1,'/hris/sync']] as const;
  // kalender
  const[y,m]=P.split('-').map(Number),first=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7,dim=new Date(Date.UTC(y,m,0)).getUTCDate();
  const mark=new Set([...db.att,...db.sched].filter(x=>x.date.startsWith(P)).map(x=>+x.date.slice(8)));
  const dateTxt=new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  return <Shell title="Dashboard" sub="Satu sumber data untuk seluruh menu.">
    <section className="hero"><Hero/><div><div className="gold">CORESTAY PEOPLE</div><h1>Selamat Datang, {(db.settings.users.find(u=>u.id===db.settings.activeUser)||db.settings.users[0])?.name||'Pengguna'}</h1><p>Kelola karyawan, absensi, dan payroll dengan lebih mudah, aman, dan terintegrasi.</p><span className="date"><Calendar size={14}/>{dateTxt}</span></div></section>
    <section className="kpis">{K.map(([I,l,v,s,c])=><article className="card kpi" key={l}><div className={`bubble ${c}`}><I size={22}/></div><div><div className="kpi-label">{l}</div><div className="kpi-value">{v}</div><div className="muted">{s}</div></div></article>)}</section>
    <section className="dash">
      <article className="card panel s4"><h2><span className="ic"><ChartColumn size={16}/></span>Tren Tenaga Kerja & Biaya<Link href="/hris/labor-cost">Lihat Labor Cost</Link></h2>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Grafik jumlah karyawan dan biaya tenaga kerja 6 bulan"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b9bff"/><stop offset="1" stopColor="#1d4fe0"/></linearGradient></defs>
          {[0,1,2,3,4].map(i=>{const y=pt+(H-pb-pt)*i/4;return <g key={i}><line x1={pl} x2={W-pr} y1={y} y2={y} stroke="#e8eefb"/><text x={pl-6} y={y+3} fontSize="9" textAnchor="end" fill="#8a99ba">{Math.round(mx*(1-i/4))}</text><text x={W-pr+6} y={y+3} fontSize="9" fill="#8a99ba">{(mc*(1-i/4)).toFixed(0)}</text></g>})}
          {T.map((t,i)=><g key={t.m}><rect x={xc(i)-17} y={yb(t.n)} width="34" height={H-pb-yb(t.n)} rx="6" fill="url(#bg)"/><text x={xc(i)} y={H-12} fontSize="10" textAnchor="middle" fill="#6a7a9e">{mLabel(t.m)}</text></g>)}
          <polyline fill="none" stroke="#13b8aa" strokeWidth="2.5" points={T.map((t,i)=>`${xc(i)},${yc(t.c)}`).join(' ')}/>{T.map((t,i)=><circle key={i} cx={xc(i)} cy={yc(t.c)} r="4" fill="#fff" stroke="#13b8aa" strokeWidth="2"/>)}</svg>
        <div className="legend"><span><i style={{background:'#1d5bff'}}/>Jumlah Karyawan</span><span><i style={{background:'#13b8aa'}}/>Biaya Tenaga Kerja (juta Rp)</span></div></article>
      <article className="card panel s2"><h2><span className="ic"><PieChart size={16}/></span>Komposisi Karyawan</h2>
        <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}><svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label="Komposisi karyawan per departemen"><circle cx="70" cy="70" r="54" fill="none" stroke="#eaf0fb" strokeWidth="18"/>
          {byDept.map(([d,n],i)=>{const len=n/act.length*C,o=acc;acc+=len;return <circle key={d} cx="70" cy="70" r="54" fill="none" stroke={COL[i%COL.length]} strokeWidth="18" strokeDasharray={`${len} ${C-len}`} strokeDashoffset={-o} transform="rotate(-90 70 70)"/>})}
          <text x="70" y="72" textAnchor="middle" fontSize="24" fontWeight="800" fill="#0f1f45">{act.length}</text><text x="70" y="88" textAnchor="middle" fontSize="10" fill="#6a7a9e">Karyawan</text></svg>
        <div style={{flex:1,minWidth:130}}>{byDept.map(([d,n],i)=><div className="row" key={d} style={{padding:'5px 0'}}><i style={{width:9,height:9,borderRadius:'50%',background:COL[i%COL.length]}}/><span className="grow">{d}</span><b style={{display:'inline'}}>{Math.round(n/act.length*100)}%</b><span className="muted">{n}</span></div>)}{!byDept.length&&<p className="muted">Belum ada karyawan aktif.</p>}</div></div></article>
      <article className="card panel s2"><h2><span className="ic"><ClipboardList size={16}/></span>Tugas yang Perlu Ditindaklanjuti</h2>{tasks.map(([t,s,n,h])=><Link key={t} href={h} className="row"><div className="grow"><b>{t}</b><span className="muted">{s}</span></div><span className={`cnt ${n>0?'hot':''}`}>{n}</span></Link>)}</article>
      <article className="card panel s2"><h2><span className="ic"><Wallet size={16}/></span>Status Payroll<Link href="/hris/approval">Lihat Semua</Link></h2><div className="table-wrap"><table><thead><tr><th>Periode</th><th>Status</th><th>Karyawan</th></tr></thead><tbody>{per.map(p=>{const[l,c]=sb(db.periods[p]||'draft');return <tr key={p}><td>{p}</td><td><span className={`badge ${c}`}>{l}</span></td><td>{act.length}</td></tr>})}</tbody></table></div></article>
      <article className="card panel s2"><h2><span className="ic"><Clock size={16}/></span>Absensi Hari Ini<Link href="/hris/attendance">Lihat Semua</Link></h2>{A.map(([l,n,c])=><div className="row" key={l}><i style={{width:9,height:9,borderRadius:'50%',background:c}}/><span style={{width:110}}>{l}</span><b style={{display:'inline',width:28}}>{n}</b><span className="bar"><i style={{width:(aTot?n/aTot*100:0)+'%',background:c}}/></span><span className="muted" style={{width:34,textAlign:'right'}}>{aTot?Math.round(n/aTot*100)+'%':'—'}</span></div>)}</article>
      <article className="card panel s2"><h2><span className="ic"><QrCode size={16}/></span>QR Absen{hotel?` · ${hotel}`:''}</h2>
        {!hotel?<p className="muted">Belum ada hotel aktif. Daftarkan di Semua Hotel & Login.</p>:tok?<div style={{textAlign:'center'}}>
          {base&&qrUrl.length<=106?<QrSvg text={qrUrl} size={150}/>:<div className="muted" style={{padding:'20px 0'}}>{base?'Alamat terlalu panjang untuk QR':'Menyiapkan QR…'}</div>}
          <div className="muted" style={{fontSize:11,wordBreak:'break-all',margin:'6px 0 8px'}}>{base&&qrUrl}</div>
          {!hasGeo&&<p className="badge wait" style={{whiteSpace:'normal'}}>Lokasi hotel belum diatur: atur di <Link href="/hris/organization">Organisasi & Hotel</Link> agar absen tervalidasi.</p>}
          <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}><button className="button" onClick={()=>setPoster(true)}>Poster & cetak</button><button className="button secondary" onClick={copyUrl}>{copied?'Tersalin ✓':'Salin tautan'}</button></div></div>
        :<div><p className="muted">Hotel ini belum punya kode QR absen.</p><button className="button" onClick={regen}>Buat QR absen</button></div>}</article>
      <article className="card panel promo s2"><h2>Satu Platform Untuk Semua Kebutuhan HR & Payroll</h2><p>Dari data karyawan hingga laporan biaya tenaga kerja, semua dalam satu sistem.</p><Link className="button" href="/hris/employees">Mulai dari Employee Master →</Link></article>
      <article className="card panel s2"><h2><span className="ic"><History size={16}/></span>Aktivitas Terbaru<Link href="/hris/audit">Lihat Semua</Link></h2>{db.audit.slice(0,5).map((a,i)=><div className="row" key={i}><div className="grow"><b style={{fontWeight:600}}>{a.m}</b></div><span className="muted">{new Date(a.t).toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span></div>)}{!db.audit.length&&<p className="muted">Belum ada aktivitas.</p>}</article>
      <article className="card panel s2"><h2><span className="ic"><Calendar size={16}/></span>Kalender<span style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center'}}><button className="button secondary" style={{padding:'4px 8px'}} aria-label="Bulan sebelumnya" onClick={()=>update(d=>({...d,period:monthAdd(d.period,-1)}))}><ChevronLeft size={14}/></button><span style={{fontSize:12,fontWeight:600}}>{new Date(P+'-01T00:00:00Z').toLocaleDateString('id-ID',{month:'long',year:'numeric',timeZone:'UTC'})}</span><button className="button secondary" style={{padding:'4px 8px'}} aria-label="Bulan berikutnya" onClick={()=>update(d=>({...d,period:monthAdd(d.period,1)}))}><ChevronRight size={14}/></button></span></h2>
        <div className="cal">{['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d=><span className="h" key={d}>{d}</span>)}{Array.from({length:first}).map((_,i)=><span key={'e'+i}/>)}{Array.from({length:dim},(_,i)=>i+1).map(d=><span key={d} className={`${P+'-'+String(d).padStart(2,'0')===today?'today':''} ${mark.has(d)?'dot':''}`}>{d}</span>)}</div><p className="muted" style={{marginTop:8}}>Titik hijau: ada jadwal atau absensi.</p></article>
    </section>
    {poster&&tok&&<HotelQr hotel={hotel} token={tok} onRegen={regen} onClose={()=>setPoster(false)}/>}
  </Shell>}
