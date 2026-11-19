import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Hls from 'hls.js'
import { getCameras } from './api'
import type { Camera } from './types'

type PlaybackMode = 'webrtc' | 'hls'
type ViewingMode = 'director' | 'multiview'
type PlaybackState = 'idle' | 'connecting' | 'playing' | 'waiting' | 'error'

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

function CameraPlayer({ camera, mode, retryKey, onStatusChange }: { camera: Camera; mode: PlaybackMode; retryKey: number; onStatusChange: (cameraId: string, state: PlaybackState) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<PlaybackState>('connecting')
  const [detail, setDetail] = useState('')
  const [telemetry, setTelemetry] = useState('')

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let disposed = false
    let hls: Hls | undefined
    let peer: RTCPeerConnection | undefined
    let whepSessionUrl: string | undefined
    let statsInterval: number | undefined
    const controller = new AbortController()
    let handshakeTimeout: number | undefined

    const setSafeState = (next: PlaybackState, message = '') => {
      if (!disposed) {
        setState(next)
        setDetail(message)
        onStatusChange(camera.id, next)
      }
    }

    setState('connecting')
    setDetail('')
    onStatusChange(camera.id, 'connecting')
    setTelemetry('')
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
      const connection = new RTCPeerConnection()
      peer = connection
      connection.addTransceiver('video', { direction: 'recvonly' })
      connection.ontrack = event => {
        if (disposed || !video) return
        if (event.streams[0]) video.srcObject = event.streams[0]
        else {
          const stream = video.srcObject instanceof MediaStream ? video.srcObject : new MediaStream()
          stream.addTrack(event.track)
          video.srcObject = stream
        }
        void video.play()
          .then(() => setSafeState('playing'))
          .catch(() => setSafeState('waiting', 'Press play to start the live feed.'))
      }
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === 'failed') {
          setSafeState('error', 'WebRTC connection failed. Try the HLS fallback or check the media server network ports.')
        }
      }

      const collectStats = async () => {
        try {
          const report = await connection.getStats()
          let roundTripMs: number | undefined
          let resolution = ''
          let framesPerSecond: number | undefined
          report.forEach(stat => {
            const values = stat as unknown as Record<string, unknown>
            if (values.type === 'candidate-pair' && values.state === 'succeeded' && values.nominated === true
              && typeof values.currentRoundTripTime === 'number') {
              roundTripMs = Math.round(values.currentRoundTripTime * 1000)
            }
            if (values.type === 'inbound-rtp' && values.kind === 'video') {
              if (typeof values.frameWidth === 'number' && typeof values.frameHeight === 'number') {
                resolution = `${values.frameWidth}×${values.frameHeight}`
              }
              if (typeof values.framesPerSecond === 'number') framesPerSecond = Math.round(values.framesPerSecond)
            }
          })
          const parts = [
            resolution,
            framesPerSecond === undefined ? '' : `${framesPerSecond} FPS`,
            roundTripMs === undefined ? '' : `RTT ${roundTripMs} ms`,
          ].filter(Boolean)
          if (!disposed) setTelemetry(parts.join(' · '))
        } catch {
          // Stats are best-effort and must never interrupt playback.
        }
      }
      statsInterval = window.setInterval(() => { void collectStats() }, 2000)
      void collectStats()

      handshakeTimeout = window.setTimeout(() => {
        controller.abort()
        setSafeState('error', 'WebRTC connection timed out. Check the feed and network, or switch to Compatibility playback.')
      }, 15000)

      const offer = await connection.createOffer()
      await connection.setLocalDescription(offer)
      await waitForIceGathering(connection)

      const response = await fetch(camera.whepUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp', Accept: 'application/sdp' },
        body: connection.localDescription?.sdp,
        signal: controller.signal,
      })
      if (!response.ok) {
        const reason = await response.text().catch(() => '')
        throw new Error(`WHEP server returned ${response.status}${reason ? `: ${reason.slice(0, 140)}` : ''}`)
      }
      if (handshakeTimeout !== undefined) window.clearTimeout(handshakeTimeout)

      const location = response.headers.get('Location')
      if (location) whepSessionUrl = new URL(location, camera.whepUrl).toString()
      const answer = await response.text()
      await connection.setRemoteDescription({ type: 'answer', sdp: answer })
    }

    if (mode === 'hls') {
      void startHls()
    } else {
      void startWebRtc().catch(cause => {
        if (cause instanceof Error && cause.name === 'AbortError') {
          setSafeState('error', 'WebRTC connection timed out. Check the feed and network, or switch to Compatibility playback.')
          return
        }
        setSafeState('error', cause instanceof Error ? cause.message : 'Unable to establish WebRTC playback.')
      })
    }

    return () => {
      disposed = true
      onStatusChange(camera.id, 'idle')
      if (handshakeTimeout !== undefined) window.clearTimeout(handshakeTimeout)
      if (statsInterval !== undefined) window.clearInterval(statsInterval)
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
  }, [camera.id, camera.hlsUrl, camera.whepUrl, mode, retryKey, onStatusChange])

  return <div className="video-shell">
    <video ref={videoRef} className="match-video" controls playsInline autoPlay muted aria-label={`${camera.name} live feed`} />
    {state !== 'playing' && <div className="video-overlay" role="status">
      <span className={`status-orb ${state === 'error' ? 'status-error' : ''}`} />
      <strong>{state === 'connecting' ? 'Connecting to camera' : state === 'waiting' ? 'Waiting for playback' : state === 'error' ? 'Feed unavailable' : 'Waiting for feed'}</strong>
      <span>{detail || (state === 'connecting' ? 'Negotiating a live connection with the media server' : 'Publish a source to this camera path to start playback')}</span>
    </div>}
    <div className="video-label"><span className="live-dot" /> {mode === 'webrtc' ? 'LOW-LATENCY WEBRTC' : 'HLS PLAYBACK'}{telemetry && <small>{telemetry}</small>}</div>
  </div>
}

export default function App() {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<PlaybackMode>('webrtc')
  const [viewingMode, setViewingMode] = useState<ViewingMode>('director')
  const [retryKey, setRetryKey] = useState(0)
  const [feedStatus, setFeedStatus] = useState<Record<string, PlaybackState>>({})

  const handleFeedStatus = useCallback((cameraId: string, status: PlaybackState) => {
    setFeedStatus(current => current[cameraId] === status ? current : { ...current, [cameraId]: status })
  }, [])

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
          <span className="mode-pill">{viewingMode === 'director' ? 'DIRECTOR MODE' : 'MULTI-VIEW'} <span>●</span></span>
        </div>
        <div className="view-mode-tabs" aria-label="Viewing layout">
          <button className={viewingMode === 'director' ? 'active' : ''} onClick={() => setViewingMode('director')} aria-pressed={viewingMode === 'director'}>DIRECTOR VIEW</button>
          <button className={viewingMode === 'multiview' ? 'active' : ''} onClick={() => setViewingMode('multiview')} aria-pressed={viewingMode === 'multiview'}>MULTI-VIEW</button>
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
          : viewingMode === 'director' && selected ? <CameraPlayer key={selected.id} camera={selected} mode={mode} retryKey={retryKey} onStatusChange={handleFeedStatus} />
          : viewingMode === 'multiview' && cameras.length > 0 ? <div className="multi-view-grid">
              {cameras.map((camera, index) => <article className={`multi-view-tile ${selectedId === camera.id ? 'featured' : ''}`} key={camera.id}>
                <div className="multi-view-heading"><span>ANGLE 0{index + 1}</span><strong>{camera.name}</strong></div>
                <CameraPlayer camera={camera} mode={mode} retryKey={retryKey} onStatusChange={handleFeedStatus} />
              </article>)}
            </div>
          : <div className="message-panel"><strong>No cameras configured</strong></div>}
        <div className="player-footer"><span>{viewingMode === 'multiview' ? 'MULTI-VIEW / INDEPENDENT FEEDS' : mode === 'webrtc' ? 'WEBRTC / WHEP' : 'HLS / HLS.JS'}</span><span>EARLY ACCESS BUILD <b>0.3</b></span></div>
      </div>

      <aside className="camera-panel">
        <div className="panel-heading"><div><span className="eyebrow">CHOOSE YOUR VIEW</span><h2>Camera angles</h2></div><span className="camera-count">{cameras.length.toString().padStart(2, '0')}</span></div>
        <div className="camera-list">
          {cameras.map((camera, index) => {
            const status = feedStatus[camera.id]
            const statusLabel = status === 'playing' ? 'ONLINE' : status === 'connecting' ? 'CONNECTING' : status === 'waiting' ? 'WAITING' : status === 'error' ? 'OFFLINE' : 'NOT OPEN'
            return <button className={`camera-option ${selectedId === camera.id ? 'selected' : ''}`} key={camera.id} onClick={() => setSelectedId(camera.id)} aria-pressed={selectedId === camera.id}>
              <span className="camera-index">0{index + 1}</span>
              <span className="camera-copy"><strong>{camera.name}</strong><small>{camera.description}</small><span className={`camera-status ${status ?? 'idle'}`}><i />{statusLabel}</span></span>
              <span className="select-indicator" aria-hidden="true">↗</span>
            </button>
          })}
          {!loading && cameras.length === 0 && <p className="empty-note">Camera feeds will appear here when configured.</p>}
        </div>
        <div className="director-note"><span className="note-icon">✳</span><div><strong>You’re the director</strong><p>Choose an angle to switch the live view, or open Multi-View to see every configured feed. Multi-View streams are not yet time-synchronized.</p></div></div>
      </aside>
    </section>
    <footer className="page-footer"><span>MATCHROOM ENGINEERING PREVIEW</span><span>BUILT FOR THE FANS. DESIGNED FOR THE GAME.</span></footer>
  </main>
}
