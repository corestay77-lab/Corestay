/* eslint-disable @next/next/no-img-element */
'use client';
import { useEffect, useState } from 'react';
import QrSvg from './QrSvg';
// Poster QR absensi per hotel: dicetak dan ditempel di pos security. Karyawan scan → /absen → ID + PIN → absen.
export default function HotelQr({hotel,token,onRegen,onClose}:{hotel:string;token:string;onRegen:()=>void;onClose:()=>void}){
  const [base,setBase]=useState('');useEffect(()=>setBase(location.origin),[]);
  const url=`${base}/absen?q=${token}`,https=base.startsWith('https://'),fits=url.length<=106;
  const [copied,setCopied]=useState(false);
  return <section className="card panel qr-print" style={{marginTop:12,textAlign:'center'}}>
    <img src="/logo.png" alt="CoreStay" width={120} style={{background:'#0a2a7a',borderRadius:12,padding:8,height:'auto'}}/>
    <h2 style={{justifyContent:'center',fontSize:22,margin:'10px 0 0'}}>Scan untuk Absen</h2><div style={{fontWeight:700,margin:'2px 0 10px'}}>{hotel}</div>
    {base&&fits?<QrSvg text={url} size={280}/>:<div role="alert" style={{maxWidth:360,margin:'14px auto',padding:16,border:'2px dashed #ff9c2f',borderRadius:14,color:'#7a4a00'}}>{base?'Alamat terlalu panjang untuk QR (maks 106 karakter). Pakai domain yang lebih pendek.':'Menyiapkan QR…'}</div>}
    <p className="muted" style={{maxWidth:340,margin:'8px auto'}}>Buka kamera HP, arahkan ke kode ini, masuk dengan ID karyawan & PIN. Selfie dan lokasi dicek otomatis dan tidak disimpan.</p>
    <div style={{fontWeight:600}}>📍 Tempel di Pos Security</div>
    {!https&&base&&<p className="qr-noprint badge wait" style={{whiteSpace:'normal',marginTop:8}}>Alamat ini bukan HTTPS publik ({base}). QR baru bisa dipakai karyawan bila dibuka dari alamat Vercel Anda (https://…vercel.app).</p>}
    <div className="qr-noprint" style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap',marginTop:12}}>
      <button className="button" disabled={!base||!fits} onClick={()=>window.print()}>Cetak poster</button>
      <button className="button secondary" onClick={async()=>{try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1500)}catch{}}}>{copied?'Tersalin ✓':'Salin tautan'}</button>
      <button className="button secondary" onClick={()=>{if(confirm('Ganti kode QR? Poster lama langsung tidak berlaku dan harus dicetak ulang.'))onRegen()}}>Ganti kode QR</button>
      <button className="button secondary" onClick={onClose}>Tutup</button></div></section>}
