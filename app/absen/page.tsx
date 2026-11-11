'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { fmtDur } from '@/lib/hris/geo';
// Halaman karyawan: scan QR hotel → ID + PIN → satu tombol Absen.
// Lokasi (akurasi + radius) dan selfie hanya dipakai untuk validasi. Foto TIDAK disimpan; yang tercatat hanya jam, jarak, dan akurasi.
type St={name:string;code:string;hotel:string;shift:string;clock_in:string|null;clock_out:string|null;kind:'in'|'out'|'done';maxAcc:number;soft?:boolean;tz:string;tzLabel:string;allowed:boolean;reason:string;strict:boolean;schedule:{name:string;start:string;end:string;opens?:string;auto?:boolean}|null};
const post=async(b:object)=>{const r=await fetch('/api/absen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return r.json()};
export default function Absen(){
  const [code,setCode]=useState(''),[pin,setPin]=useState(''),[st,setSt]=useState<St|null>(null),[msg,setMsg]=useState<{t:string;ok:boolean}|null>(null),[busy,setBusy]=useState(false);
  const [pos,setPos]=useState<GeolocationPosition|null>(null),[locating,setLocating]=useState(false),[cam,setCam]=useState(false);
  const [qr,setQr]=useState(''),[hotel,setHotel]=useState<string|null>(null),[qrErr,setQrErr]=useState('');
  const [clock,setClock]=useState(''),[secs,setSecs]=useState(0),tick=useRef<any>(null),tout=useRef<any>(null);
  const vid=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),watch=useRef<number|null>(null);
  const say=(t:string,ok=false)=>setMsg({t,ok});
  const stopCam=()=>{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setCam(false)};
  const stopGps=()=>{if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);watch.current=null;clearInterval(tick.current);clearTimeout(tout.current);setLocating(false)};
  useEffect(()=>{
    let q=new URLSearchParams(location.search).get('q')||'';
    try{setCode(localStorage.getItem('cs-emp-code')||'');if(q)localStorage.setItem('cs-qr',q);else q=localStorage.getItem('cs-qr')||''}catch{}
    setQr(q);if(!q){setQrErr('Scan QR absen di pos security hotel untuk memulai.');return}
    fetch('/api/absen?q='+encodeURIComponent(q)).then(r=>r.json()).then(r=>{if(r.ok)setHotel(r.hotel);else{setQrErr(r.error);try{localStorage.removeItem('cs-qr')}catch{}}}).catch(()=>setQrErr('Tidak bisa terhubung ke server. Periksa koneksi internet.'));
    return()=>{stopCam();stopGps()}},[]);
  // Ambil lokasi: GPS HP butuh waktu untuk 'mengunci' (awalnya hanya lokasi jaringan yang kasar). Terus dipantau sampai akurasi memenuhi batas
  // (maks 3 menit), dan posisi terbaik dipakai. Kegagalan sesaat tidak menghentikan pencarian.
  const locate=(max=100)=>{stopGps();setPos(null);setLocating(true);setMsg(null);setSecs(0);const t0=Date.now();
    tick.current=setInterval(()=>setSecs(Math.round((Date.now()-t0)/1000)),1000);tout.current=setTimeout(stopGps,180000);
    watch.current=navigator.geolocation.watchPosition(p=>{setPos(old=>!old||p.coords.accuracy<=old.coords.accuracy?p:old);if(p.coords.accuracy<=max)stopGps()},
      e=>{if(e.code===1){stopGps();say('Izin lokasi ditolak. Izinkan lokasi untuk situs ini di pengaturan browser, lalu tekan Ulangi lokasi.')}},{enableHighAccuracy:true,timeout:30000,maximumAge:0})};
  const openCam=async()=>{try{if(stream.current)stream.current.getTracks().forEach(t=>t.stop());const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});stream.current=s;setCam(true);return true}catch{setCam(false);say('Kamera tidak bisa diakses. Izinkan kamera di browser (alamat harus https).');return false}};
  useEffect(()=>{const v=vid.current;if(cam&&v&&stream.current&&v.srcObject!==stream.current){v.srcObject=stream.current;v.play().catch(()=>{})}},[cam,st]);
  const login=async()=>{setBusy(true);setMsg(null);
    try{const r=await post({op:'status',code,pin,q:qr});if(!r.ok){setSt(null);say(r.error)}else{setSt(r);try{localStorage.setItem('cs-emp-code',code.toUpperCase())}catch{}if(r.kind!=='done'&&r.allowed){locate(r.maxAcc);openCam()}}}catch{say('Tidak bisa terhubung ke server.')}setBusy(false)};
  // Cek selfie di HP: kamera aktif, gambar tidak gelap/kosong, dan wajah terdeteksi bila browser mendukung. Hasilnya tidak disimpan.
  const selfie=async():Promise<{img?:string;why?:string}>=>{
    const v=vid.current;if(!v||!v.videoWidth)return{why:'Kamera belum siap.'};
    const c=document.createElement('canvas');c.width=320;c.height=Math.round(320*v.videoHeight/v.videoWidth);const x=c.getContext('2d')!;x.drawImage(v,0,0,c.width,c.height);
    const d=x.getImageData(0,0,c.width,c.height).data;let s=0,s2=0,n=d.length/4;for(let i=0;i<d.length;i+=4){const l=.3*d[i]+.59*d[i+1]+.11*d[i+2];s+=l;s2+=l*l}
    const mean=s/n,sd=Math.sqrt(Math.max(0,s2/n-mean*mean));if(mean<25||sd<12)return{why:'Foto terlalu gelap atau tertutup. Pastikan wajah terlihat jelas.'};
    const FD=(window as any).FaceDetector;if(FD){try{const f=await new FD({fastMode:true}).detect(c);if(!f.length)return{why:'Wajah tidak terdeteksi. Hadapkan wajah ke kamera.'}}catch{}}
    return{img:c.toDataURL('image/jpeg',.5)}};
  // jam di lokasi hotel (dari zona waktu hotel, bukan jam HP)
  useEffect(()=>{if(!st)return;const f=()=>setClock(new Intl.DateTimeFormat('id-ID',{timeZone:st.tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).replace('.',':'));f();const t=setInterval(f,15000);return()=>clearInterval(t)},[st?.tz]);
  const maxAcc=st?.maxAcc||100,accOk=!!pos&&pos.coords.accuracy<=maxAcc;
  const send=async()=>{if(!st||st.kind==='done')return;
    if(!st.allowed){say(st.reason);return}
    if(!st.soft){
      if(!pos){say(locating?'Lokasi masih dicari, tunggu beberapa detik.':'Lokasi belum terbaca. Mencari lokasi lagi…');if(!locating)locate(maxAcc);return}
      if(!accOk){const a=Math.round(pos.coords.accuracy);say(a>500?`Lokasi masih kasar (±${a} m). Aktifkan Lokasi Presisi — lihat petunjuk kuning di bawah.`:`Akurasi GPS ±${a} m, perlu ≤ ${maxAcc} m. Tunggu beberapa detik sampai akurasi membaik, atau minta HRD menaikkan batas akurasi di Pengaturan.`);return}}
    if(!cam||!vid.current?.videoWidth){say('Kamera belum siap. Mengaktifkan kamera…');await openCam();return}
    setBusy(true);setMsg(null);
    const s=await selfie();if(!s.img){say(s.why!);setBusy(false);return}
    try{const r=await post({op:'clock',code,pin,q:qr,...(pos?{lat:pos.coords.latitude,lng:pos.coords.longitude,acc:pos.coords.accuracy}:{}),selfie:s.img});
      if(!r.ok)say(r.error);else{
        say(r.kind==='in'?`Absen masuk berhasil pukul ${r.time} ${r.tzLabel}${r.lateMin>0?` · terlambat ${fmtDur(r.lateMin)}`:''}. Tercatat di rekap.${r.warn?` (lokasi ditandai untuk dicek HRD: ${r.warn})`:''}`:`Absen pulang berhasil pukul ${r.time} ${r.tzLabel} · ${r.hours} jam kerja${r.ot>0?` · lembur ${r.ot} jam`:''}. Tercatat di rekap.${r.warn?` (lokasi ditandai untuk dicek HRD: ${r.warn})`:''}`,true);
        stopCam();stopGps();setPos(null);const n=await post({op:'status',code,pin,q:qr});if(n.ok)setSt(n)}
    }catch{say('Tidak bisa terhubung ke server.')}setBusy(false)};
  const card:React.CSSProperties={background:'#fff',borderRadius:18,padding:18,boxShadow:'0 10px 30px -12px rgba(18,52,140,.3)',marginBottom:12};
  const inp:React.CSSProperties={width:'100%',padding:'13px 14px',border:'1px solid #dbe5f8',borderRadius:12,fontSize:16,marginBottom:10};
    return <main style={{minHeight:'100vh',background:'linear-gradient(180deg,#040d2a,#0a2a7a 220px,#eef3fc 220px)',padding:'18px 14px 40px'}}><div style={{maxWidth:460,margin:'0 auto'}}>
    <div style={{textAlign:'center',color:'#fff',marginBottom:18}}><img src="/logo.png" alt="CoreStay Advisory" width={150} style={{height:'auto',display:'block',margin:'0 auto 6px'}}/><div style={{fontSize:12,letterSpacing:2,color:'#9fb4dc'}}>ABSENSI KARYAWAN</div></div>
    {hotel&&<div style={{...card,padding:'12px 16px',borderLeft:'5px solid #13b8aa'}}>📍 Absen di <b>{hotel}</b></div>}
    {qrErr&&!hotel&&<div role="alert" style={{...card,borderLeft:'5px solid #ff9c2f'}}>{qrErr}</div>}
    {hotel&&!st&&<div style={card}><h2 style={{margin:'0 0 12px',fontSize:17}}>Masuk</h2>
      <input style={inp} placeholder="ID karyawan (mis. EMP-0001)" value={code} onChange={e=>setCode(e.target.value)} autoCapitalize="characters" aria-label="ID karyawan"/>
      <input style={inp} placeholder="PIN" type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&code&&pin&&login()} aria-label="PIN"/>
      <button className="button" style={{width:'100%',padding:14}} disabled={busy||!code||!pin} onClick={login}>{busy?'Memeriksa…':'Lanjut'}</button></div>}
    {st&&<><div style={card}><div style={{fontWeight:800,fontSize:18}}>{st.name}</div><div className="muted">{st.code} · {st.hotel}</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}><span className="badge">Jam hotel: {clock} {st.tzLabel}</span><span className="badge">Shift: {st.shift}</span><span className="badge">Masuk: {st.clock_in||'—'}</span><span className="badge">Pulang: {st.clock_out||'—'}</span></div></div>
      {st.kind==='in'&&<div style={{...card,borderLeft:`5px solid ${st.allowed?'#13b8aa':'#ff3b5c'}`}}><div className="muted" style={{fontSize:12}}>JADWAL HARI INI</div>
        {st.schedule?<div style={{fontSize:21,fontWeight:800,margin:'2px 0 6px'}}>{st.schedule.name} · {st.schedule.start}–{st.schedule.end}</div>:<div style={{fontSize:18,fontWeight:800,margin:'2px 0 6px'}}>Tidak ada jadwal</div>}
        {st.allowed?<span className="badge ok">✓ Sesuai jadwal{st.schedule?.auto?' (otomatis)':''} — silakan absen</span>:<><p role="alert" style={{margin:'0 0 10px',fontWeight:600,color:'#b91c1c'}}>✕ {st.reason}</p><button className="button secondary" disabled={busy} onClick={login}>Cek lagi</button></>}</div>}
      {st.kind==='done'?<div className="badge ok" style={{display:'block',textAlign:'center',padding:12,marginBottom:12}}>Absensi hari ini selesai ✓</div>
      :!st.allowed?null:<div style={card}><video ref={vid} playsInline muted style={{width:'100%',borderRadius:14,display:cam?'block':'none',transform:'scaleX(-1)',marginBottom:10}}/>
        <div style={{display:'flex',gap:8,marginBottom:10,fontSize:12,flexWrap:'wrap'}}>
          <span className={`badge ${accOk?'ok':'wait'}`}>{pos?`Lokasi ±${Math.round(pos.coords.accuracy)} m${accOk?'':` (perlu ≤ ${maxAcc} m)${locating?` · ${secs} dtk`:''}`}`:locating?`Mencari lokasi… ${secs} dtk`:'Lokasi belum siap'}</span>
          <span className={`badge ${cam?'ok':'wait'}`}>{cam?'Kamera siap':'Kamera belum siap'}</span></div>
        {pos&&pos.coords.accuracy>500&&secs>=8&&<div role="note" style={{background:'#fff7e0',border:'1px solid #ffd277',borderRadius:12,padding:12,marginBottom:10,fontSize:13,lineHeight:1.5}}><b>Lokasi HP masih kasar (±{Math.round(pos.coords.accuracy)} m).</b> Hampir selalu karena izin lokasi diset &quot;Perkiraan&quot;, bukan &quot;Presisi&quot;.<br/><b>Android:</b> ketuk ikon gembok di alamat → Izin → Lokasi → pilih <b>Presisi</b> (atau Pengaturan → Aplikasi → Chrome → Izin → Lokasi → nyalakan <b>Gunakan lokasi presisi</b>).<br/><b>iPhone:</b> Pengaturan → Privasi → Layanan Lokasi → Situs Web Safari → nyalakan <b>Lokasi Presisi</b>.<br/>Lalu muat ulang halaman ini dan tekan <b>Ulangi lokasi</b>.</div>}
        <button className="button" style={{width:'100%',padding:16,fontSize:17}} disabled={busy} onClick={send}>{busy?'Memproses…':st.kind==='in'?'Absen Masuk':'Absen Pulang'}</button>
        <div style={{display:'flex',gap:8,marginTop:10}}><button className="button secondary" style={{flex:1}} onClick={()=>locate(maxAcc)}>Ulangi lokasi</button><button className="button secondary" style={{flex:1}} onClick={cam?stopCam:openCam}>{cam?'Matikan kamera':'Nyalakan kamera'}</button></div></div>}
      <button className="button secondary" style={{width:'100%'}} onClick={()=>{stopCam();stopGps();setSt(null);setPin('');setPos(null);setMsg(null)}}>Keluar</button></>}
    {msg&&<div role="status" style={{...card,marginTop:12,borderLeft:`5px solid ${msg.ok?'#13b8aa':'#ff3b5c'}`}}>{msg.t}</div>}
    <p className="muted" style={{textAlign:'center',marginTop:16}}>Selfie dan lokasi hanya dipakai untuk memeriksa absen dan tidak disimpan. Pastikan Anda berada di area hotel.</p></div></main>}
