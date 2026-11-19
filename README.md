# Matchroom

Matchroom is an interactive football viewing platform. This repository begins with the camera-engine foundation: a separately deployable stack for ingesting multiple authorized match-camera feeds and switching between them in a browser.

## Architecture

```text
Authorized camera sources -- RTSP --> MediaMTX
                                      |-- HLS :8888 --> React player
                                      |-- WebRTC :8889 (next playback milestone)
Spring Boot API :8080 ----------------+--> camera catalogue
```

The first browser playback path uses HLS for compatibility. Video processing does not run inside Spring Boot.

> **Rights and access:** only ingest and distribute feeds you are authorized to use. Stadium/broadcast camera access requires an agreement with a club, production provider, or broadcaster. This scaffold does not provide access to protected broadcasts.

## Run locally

Requirements: Docker Desktop with Compose. Then run from the repository root:

```bash
docker compose up --build
```

- Web app: http://localhost:3000
- API health: http://localhost:8080/actuator/health
- Camera catalogue: http://localhost:8080/api/cameras
- MediaMTX HLS: http://localhost:8888

The camera list is available before publishers connect. The player will show a waiting state until a feed is publishing.

## Publish a test feed

With FFmpeg installed, publish a generated test pattern (not broadcast footage):

```bash
ffmpeg -re -f lavfi -i testsrc2=size=1280x720:rate=25 -f lavfi -i sine=frequency=440:sample_rate=48000 -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p -c:a aac -f rtsp rtsp://localhost:8554/cam-main
```

Repeat for `cam-behind-goal` and `cam-tactical`. HLS URLs:

- http://localhost:8888/cam-main/index.m3u8
- http://localhost:8888/cam-behind-goal/index.m3u8
- http://localhost:8888/cam-tactical/index.m3u8

HLS is segment-based. Low-latency WebRTC playback, clock synchronization, audio mixing, and Smart Camera tracking are follow-on milestones, not claimed as complete.

## Local development

Backend: `cd backend && mvn spring-boot:run`

Frontend: `cd frontend && npm install && npm run dev`

## Roadmap

1. Foundation: media server, camera catalogue, browser player, manual camera selection.
2. Playback reliability: WebRTC/WHEP, reconnect strategy, feed health and latency telemetry.
3. Synchronization: shared match clock, timestamp alignment, camera-switch discontinuity tests.
4. Immersive audio: authorized ambient audio source and independent mix controls.
5. Smart Camera: computer-vision ball/action framing with manual override.
6. Multi-View: synchronized simultaneous feeds and responsive layouts.

## Engineering principles

- Keep media ingestion, transcoding, and computer vision outside Spring Boot.
- Treat feed licensing and operational availability as first-class dependencies.
- Measure latency, uptime, and synchronization before making live-performance promises.
- Validate the smallest pilot with real authorized feeds before scaling.
