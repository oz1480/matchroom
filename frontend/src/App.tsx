import { useEffect, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'
import { getCameras } from './api'
import type { Camera } from './types'

type PlaybackState = 'loading' | 'ready' | 'unavailable'

function CameraPlayer({ camera }: { camera: Camera }) {
 const videoRef = useRef<HTMLVideoElement>(null)
 const [state,setState] = useState<PlaybackState>('loading')
 useEffect(()=>{
  const video=videoRef.current
  if(!video)return
  let hls:Hls|undefined
  let disposed=false
  setState('loading')
  const ready=()=>{if(!disposed)setState('ready')}
  const unavailable=()=>{if(!disposed)setState('unavailable')}
  if(Hls.isSupported()){
   hls=new Hls({enableWorker:true,lowLatencyMode:true,backBufferLength:30})
   hls.loadSource(camera.streamUrl);hls.attachMedia(video)
   hls.on(Hls.Events.MANIFEST_PARSED,ready)
   hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal)unavailable()})
  }else if(video.canPlayType('application/vnd.apple.mpegurl')){
   video.src=camera.streamUrl
   video.addEventListener('loadedmetadata',ready,{once:true})
   video.addEventListener('error',unavailable,{once:true})
  }else unavailable()
  return ()=>{disposed=true;hls?.destroy();video.pause();video.removeAttribute('src');video.load()}
 },[camera.id,camera.streamUrl])
 return <div className="video-shell">
  <video ref={videoRef} className="match-video" controls playsInline autoPlay muted aria-label={`${camera.name} live feed`}/>
  {state!=='ready'&&<div className="video-overlay" role="status"><span className="status-orb"/><strong>{state==='loading'?'Connecting to camera':'Feed not available yet'}</strong><span>{state==='loading'?'Waiting for the media server':'Publish a source to this camera path to start playback'}</span></div>}
  <div className="video-label"><span className="live-dot"/> LIVE FEED</div>
 </div>
}

export default function App(){
 const [cameras,setCameras]=useState<Camera[]>([])
 const [selectedId,setSelectedId]=useState('')
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 useEffect(()=>{
  const controller=new AbortController()
  getCameras(controller.signal).then(items=>{
   const sorted=[...items].sort((a,b)=>a.order-b.order)
   setCameras(sorted);setSelectedId(current=>current||sorted[0]?.id||'')
  }).catch(cause=>{
   if(cause instanceof Error&&cause.name==='AbortError')return
   setError(cause instanceof Error?cause.message:'Unable to load cameras')
  }).finally(()=>setLoading(false))
  return ()=>controller.abort()
 },[])
 const selected=useMemo(()=>cameras.find(camera=>camera.id===selectedId),[cameras,selectedId])
 return <main className="app-shell">
  <header className="topbar"><a className="brand" href="/" aria-label="Matchroom home"><span className="brand-mark">M</span><span>MATCH<span className="brand-accent">ROOM</span></span></a><div className="topbar-meta"><span className="signal-dot"/> CAMERA ENGINE <span className="meta-divider">/</span> LOCAL PREVIEW</div></header>
  <section className="intro"><div className="eyebrow">THE MATCH. YOUR ANGLE.</div><h1>Take control<br/><span>of the game.</span></h1><p>One match. Multiple perspectives. Switch the view whenever you want.</p></section>
  <section className="watch-layout" aria-label="Match camera room">
   <div className="player-column">
    <div className="section-heading"><div><span className="eyebrow">NOW WATCHING</span><h2>{selected?.name??'Camera room'}</h2></div><span className="mode-pill">DIRECTOR MODE <span>●</span></span></div>
    {error?<div className="message-panel" role="alert"><strong>Camera service unavailable</strong><span>{error}</span><button onClick={()=>window.location.reload()}>Retry connection</button></div>:loading?<div className="message-panel"><strong>Loading camera room…</strong></div>:selected?<CameraPlayer camera={selected}/>:<div className="message-panel"><strong>No cameras configured</strong></div>}
    <div className="player-footer"><span>HLS PLAYBACK</span><span>EARLY ACCESS BUILD <b>0.1</b></span></div>
   </div>
   <aside className="camera-panel">
    <div className="panel-heading"><div><span className="eyebrow">CHOOSE YOUR VIEW</span><h2>Camera angles</h2></div><span className="camera-count">{cameras.length.toString().padStart(2,'0')}</span></div>
    <div className="camera-list">{cameras.map((camera,index)=><button className={`camera-option ${selectedId===camera.id?'selected':''}`} key={camera.id} onClick={()=>setSelectedId(camera.id)} aria-pressed={selectedId===camera.id}><span className="camera-index">0{index+1}</span><span className="camera-copy"><strong>{camera.name}</strong><small>{camera.description}</small></span><span className="select-indicator" aria-hidden="true">↗</span></button>)}{!loading&&cameras.length===0&&<p className="empty-note">Camera feeds will appear here when configured.</p>}</div>
    <div className="director-note"><span className="note-icon">✳</span><div><strong>You’re the director</strong><p>Choose an angle to switch the live view. More viewing modes are coming.</p></div></div>
   </aside>
  </section>
  <footer className="page-footer"><span>MATCHROOM ENGINEERING PREVIEW</span><span>BUILT FOR THE FANS. DESIGNED FOR THE GAME.</span></footer>
 </main>
}
