# Matchroom

Matchroom is an interactive football viewing platform. This repository is the camera-engine prototype: ingest multiple authorized camera feeds and let a viewer choose the angle in a browser.

## Current capabilities

- Three MediaMTX publisher paths: main, behind-goal, and tactical.
- Spring Boot API catalogue with HLS and WHEP URLs.
- WebRTC/WHEP browser playback as the preferred low-latency path.
- HLS.js playback as a compatibility fallback.
- Manual Director View and a three-feed Multi-View preview.
- WebRTC telemetry for negotiated video resolution, frame rate, and ICE round-trip time when available.
- Reconnect control and a compatibility playback selector.
- Docker Compose development stack, Windows test-feed scripts, and CI checks.

This is an engineering prototype, not a production broadcast platform. Latency and reliability must be measured with real authorized feeds before any service-level promise.

## Architecture

```text
Authorized camera sources -- RTSP/TCP --> MediaMTX
                                          |-- WebRTC/WHEP :8889 --> Browser (preferred)
                                          |-- HLS :8888 ----------> Browser (fallback)
Spring Boot API :8080 --------------------+--> camera catalogue
```

Video ingestion, transcoding, and computer vision are deliberately kept outside Spring Boot.

> **Rights and access:** only ingest and distribute feeds you are authorized to use. Stadium/broadcast camera access requires an agreement with a club, production provider, or broadcaster. This repository does not provide access to protected broadcasts.

## Run locally

Requirements: Docker Desktop with Compose. From the repository root:

```bash
docker compose up --build
```

- Web app: http://localhost:3000
- API health: http://localhost:8080/actuator/health
- Camera catalogue: http://localhost:8080/api/cameras
- MediaMTX HLS: http://localhost:8888
- MediaMTX WebRTC/WHEP: http://localhost:8889

The local stack pins MediaMTX v1.21.4 and Spring Boot 4.1.2. The ports are bound to localhost for local development. Do not expose this configuration directly to the public internet.

## Publish a generated test feed

Install FFmpeg on the host. In a terminal, publish a generated test pattern (not broadcast footage):

```bash
ffmpeg -re -f lavfi -i testsrc2=size=1280x720:rate=25 -f lavfi -i sine=frequency=440:sample_rate=48000 -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p -c:a aac -rtsp_transport tcp -f rtsp rtsp://localhost:8554/cam-main
```

Repeat in separate terminals for `cam-behind-goal` and `cam-tactical`, changing the final path. On Windows, after installing FFmpeg and Docker, you can start all three distinct test feeds together:

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\start-test-feeds.ps1
```

Stop them with:

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\stop-test-feeds.ps1
```

The script creates three visibly different generated test patterns and writes logs under `.local/test-feeds`. The browser defaults to WebRTC; choose **Compatibility** if your network cannot establish the WebRTC connection.

HLS URLs:

- http://localhost:8888/cam-main/index.m3u8
- http://localhost:8888/cam-behind-goal/index.m3u8
- http://localhost:8888/cam-tactical/index.m3u8

WebRTC uses WHEP session negotiation. ICE connectivity depends on the host/network; remote deployments need correct public IP/host advertisement, UDP reachability, and often a TURN server. The local config is not a production NAT traversal setup.

## Configuration

- `MATCHROOM_MEDIA_PUBLIC_BASE_URL`: public HLS base URL, default `http://localhost:8888`.
- `MATCHROOM_MEDIA_WEBRTC_BASE_URL`: public WHEP base URL, default `http://localhost:8889`.
- MediaMTX settings: `infra/mediamtx/mediamtx.yml`.

When deploying outside localhost, update the public base URLs, CORS allowlists, WebRTC additional hosts, TLS, firewall rules, and TURN configuration together.

## Local development

Backend:

```bash
cd backend
mvn spring-boot:run
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Quality checks

```bash
cd backend && mvn --batch-mode verify
cd frontend && npm install && npm run build
```

GitHub Actions runs backend tests and the frontend production build on pushes and pull requests.

## Roadmap

1. **Camera engine hardening:** feed health, reconnect/backoff, measured end-to-end latency, and synchronized multi-camera clocks.
2. **Director experience:** synchronized Multi-View and seamless angle transitions.
3. **Immersive audio:** authorized ambient audio source with independent mix controls.
4. **Smart Camera:** computer-vision ball/action framing with manual override.
5. **Pilot operations:** authenticated club/operator control plane, secure ingest credentials, monitoring, and a real-feed test with a rights-holding partner.

## Engineering principles

- Never put video transcoding or computer vision in the Spring Boot request path.
- Treat feed licensing, availability, and security as first-class dependencies.
- Measure latency, uptime, and synchronization before promising a live experience.
- Do not treat generated test patterns as proof of real-match performance.
