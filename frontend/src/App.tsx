import { useEffect, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'
import { getCameras } from './api'
import type { Camera } from './types'

type PlaybackMode = 'webrtc' | 'hls'
type PlaybackState = 'connecting' | 'playing' | 'waiting' | 'error'

function waitForIceGathering(peer: RTCPeerConnection, timeoutMs = 4000): Promise<void> {
  if (peer.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise(resolve => {
    const timeout = window.setTimeout(finish, timeoutMs)
    function finish() {
      window.clearTimeout(timeout)
      peer.removeEventListener('icegatheringstatechange', onStateChange)
      resolve()
    }
    function onStateChange() {
      if (peer.iceGatheringState === 'complete') finish()
    }
    peer.addEventListener('icegatheringstatechange', onStateChange)
  })
}

function CameraPlayer({ camera, mode, retryKey }: { camera: Camera; mode: PlaybackMode; retryKey: number }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<PlaybackState>('connecting')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let disposed = false
    let hls: Hls | undefined
    let peer: RTCPeerConnection | undefined
    let whepSessionUrl: string | undefined
    const controller = new AbortController()

    const setSafeState = (next: PlaybackState, message = '') => {
      if (!disposed) {
        setState(next)
        setDetail(message)
      }
    }

    setState('connecting')
    setDetail('')
    video.srcObject = null
    video.removeAttribute('src')
    video.load()

    async function startHls() {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          maxLiveSyncPlaybackRate: 1.15,
        })
        hls.loadSource(camera.hlsUrl)
        hls.attachMedia(video!)
        hls.on(Hls.Events.MANIFEST_PARSED, () => setSafeState('playing'))
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setSafeState('error', 'HLS stream could not be loaded. Check that a publisher is connected.')
        })
      } else if (video!.canPlayType('application/vnd.apple.mpegurl')) {
        video!.src = camera.hlsUrl
        video!.addEventListener('loadedmetadata', () => setSafeState('playing'), { once: true })
        video!.addEventListener('error', () => setSafeState('error', 'The HLS stream is unavailable.'), { once: true })
      } else {
        setSafeState('error', 'This browser does not support HLS playback.')
      }
    }

    async function startWebRtc() {
      peer = new RTCPeerConnection()
      peer.addTransceiver('video', { direction: 'recvonly' })
      peer.addTransceiver('audio', { direction: 'recvonly' })
      peer.ontrack = event => {
        if (disposed || !video) return
        if (event.streams[0]) video.srcObject = event.streams[0]
        else {
          const stream = video.srcObject instanceof MediaStream ? video.srcObject : new MediaStream()
          stream.addTrack(event.track)
          video.srcObject = stream
        }
        void video.play().catch(() => setSafeState('waiting', 'Press play to start the live feed.'))
        setSafeState('playing')
      }
      peer.onconnectionstatechange = () => {
        if (peer?.connectionState === 'failed') {
          setSafeState('error', 'WebRTC connection failed. Try the HLS fallback or check the media server network ports.')
        }
      }

      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      await waitForIceGathering(peer)

      const response = await fetch(camera.whepUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp', Accept: 'application/sdp' },
        body: peer.localDescription?.sdp,
        signal: controller.signal,
      })
      if (!response.ok) {
        const reason = await response.text().catch(() => '')
        throw new Error(`WHEP server returned ${response.status}${reason ? `: ${reason.slice(0, 140)}` : ''}`)
      }

      const location = response.headers.get('Location')
      if (location) whepSessionUrl = new URL(location, camera.whepUrl).toString()
      const answer = await response.text()
      await peer.setRemoteDescription({ type: 'answer', sdp: answer })
    }

    if (mode === 'hls') {
      void startHls()
    } else {
      void startWebRtc().catch(cause => {
        if (cause instanceof Error && cause.name === 'AbortError') return
        setSafeState('error', cause instanceof Error ? cause.message : 'Unable to establish WebRTC playback.')
      })
    }

    return () => {
      disposed = true
      controller.abort()
      hls?.destroy()
      peer?.close()
      if (whepSessionUrl) {
        void fetch(whepSessionUrl, { method: 'DELETE', keepalive: true }).catch(() => undefined)
      }
      video.pause()
      video.srcObject = null
      video.removeAttribute('src')
      video.load()
    }
  }, [camera.id, camera.hlsUrl, camera.whepUrl, mode, retryKey])

  return <div className="video-shell">
    <video ref={videoRef} className="match-video" controls playsInline autoPlay muted aria-label={`${camera.name} live feed`} />
    {state !== 'playing' && <div className="video-overlay" role="status">
      <span className={`status-orb ${state === 'error' ? 'status-error' : ''}`} />
      <strong>{state === 'connecting' ? 'Connecting to camera' : state === 'waiting' ? 'Waiting for playback' : state === 'error' ? 'Feed unavailable' : 'Waiting for feed'}</strong>
      <span>{detail || (state === 'connecting' ? 'Negotiating a live connection with the media server' : 'Publish a source to this camera path to start playback')}</span>
    </div>}
    <div className="video-label"><span className="live-dot" /> {mode === 'webrtc' ? 'LOW-LATENCY WEBRTC' : 'HLS PLAYBACK'}</div>
  </div>
}

export default function App() {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<PlaybackMode>('webrtc')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getCameras(controller.signal).then(items => {
      const sorted = [...items].sort((a, b) => a.order - b.order)
      setCameras(sorted)
      setSelectedId(current => current || sorted[0]?.id || '')
    }).catch(cause => {
      if (cause instanceof Error && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : 'Unable to load cameras')
    }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  const selected = useMemo(() => cameras.find(camera => camera.id === selectedId), [cameras, selectedId])

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="Matchroom home"><span className="brand-mark">M</span><span>MATCH<span className="brand-accent">ROOM</span></span></a>
      <div className="topbar-meta"><span className="signal-dot" /> CAMERA ENGINE <span className="meta-divider">/</span> LOCAL PREVIEW</div>
    </header>

    <section className="intro">
      <div className="eyebrow">THE MATCH. YOUR ANGLE.</div>
      <h1>Take control<br /><span>of the game.</span></h1>
      <p>One match. Multiple perspectives. Switch the view whenever you want.</p>
    </section>

    <section className="watch-layout" aria-label="Match camera room">
      <div className="player-column">
        <div className="section-heading">
          <div><span className="eyebrow">NOW WATCHING</span><h2>{selected?.name ?? 'Camera room'}</h2></div>
          <span className="mode-pill">DIRECTOR MODE <span>●</span></span>
        </div>
        <div className="playback-toolbar" aria-label="Playback protocol">
          <div className="playback-tabs">
            <button className={mode === 'webrtc' ? 'active' : ''} onClick={() => setMode('webrtc')} aria-pressed={mode === 'webrtc'}>LOW LATENCY</button>
            <button className={mode === 'hls' ? 'active' : ''} onClick={() => setMode('hls')} aria-pressed={mode === 'hls'}>COMPATIBILITY</button>
          </div>
          <button className="retry-button" onClick={() => setRetryKey(value => value + 1)}>RECONNECT ↻</button>
        </div>
        {error ? <div className="message-panel" role="alert"><strong>Camera service unavailable</strong><span>{error}</span><button onClick={() => window.location.reload()}>Retry service</button></div>
          : loading ? <div className="message-panel"><strong>Loading camera room…</strong></div>
          : selected ? <CameraPlayer key={selected.id} camera={selected} mode={mode} retryKey={retryKey} />
          : <div className="message-panel"><strong>No cameras configured</strong></div>}
        <div className="player-footer"><span>{mode === 'webrtc' ? 'WEBRTC / WHEP' : 'HLS / HLS.JS'}</span><span>EARLY ACCESS BUILD <b>0.2</b></span></div>
      </div>

      <aside className="camera-panel">
        <div className="panel-heading"><div><span className="eyebrow">CHOOSE YOUR VIEW</span><h2>Camera angles</h2></div><span className="camera-count">{cameras.length.toString().padStart(2, '0')}</span></div>
        <div className="camera-list">
          {cameras.map((camera, index) => <button className={`camera-option ${selectedId === camera.id ? 'selected' : ''}`} key={camera.id} onClick={() => setSelectedId(camera.id)} aria-pressed={selectedId === camera.id}>
            <span className="camera-index">0{index + 1}</span><span className="camera-copy"><strong>{camera.name}</strong><small>{camera.description}</small></span><span className="select-indicator" aria-hidden="true">↗</span>
          </button>)}
          {!loading && cameras.length === 0 && <p className="empty-note">Camera feeds will appear here when configured.</p>}
        </div>
        <div className="director-note"><span className="note-icon">✳</span><div><strong>You’re the director</strong><p>Choose an angle to switch the live view. If a live connection cannot be established, switch to Compatibility playback.</p></div></div>
      </aside>
    </section>
    <footer className="page-footer"><span>MATCHROOM ENGINEERING PREVIEW</span><span>BUILT FOR THE FANS. DESIGNED FOR THE GAME.</span></footer>
  </main>
}
