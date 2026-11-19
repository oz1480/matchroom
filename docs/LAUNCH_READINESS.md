# Matchroom launch-readiness checklist

This document is a release gate, not a claim that the items are complete. The current repository is a local camera-engine prototype.

## Release 0: engineering preview (current scope)

- [x] Camera catalogue API with three configured camera paths.
- [x] MediaMTX RTSP ingest, WebRTC/WHEP playback, and HLS fallback configuration.
- [x] Director View and independent Multi-View UI.
- [x] Generated FFmpeg test-feed scripts for local development.
- [x] Backend unit/API tests and browser E2E test definitions.
- [ ] GitHub Actions reports successful results for every required job.
- [ ] A clean Windows machine can follow the README and run the stack from scratch.
- [ ] Manual browser testing completed on Chrome, Edge, Safari/iOS, and Android browsers.
- [ ] Playback recovery, browser background/foreground, network loss, and server restart behavior verified.

## Release 1: private pilot (not ready)

### Rights and operations
- [ ] Written permission and distribution rights for every camera and audio feed.
- [ ] Club/production partner, match schedule, named technical contact, and operating runbook.
- [ ] Feed inventory with resolution, frame rate, codec, audio policy, latency, and backup source.
- [ ] Consent, privacy, retention, and data-processing review for any recorded or identifiable footage.

### Infrastructure and security
- [ ] Production hosting selected in the required geographic region.
- [ ] TLS everywhere; production CORS allowlist; no localhost URLs.
- [ ] Authenticated operator/admin access and per-feed ingest credentials.
- [ ] Network policy and firewall rules; TURN service and tested NAT traversal.
- [ ] Secrets stored in a managed secret store; rotation and revocation procedure.
- [ ] Rate limiting, request validation, abuse protection, and dependency/image scanning.
- [ ] Backups, restore test, logs, metrics, alerting, and incident response.
- [ ] Capacity and load tests for concurrent viewers, bitrate, egress, and reconnect storms.

### Streaming quality
- [ ] Real camera feeds tested end-to-end on target networks and devices.
- [ ] Measured glass-to-glass latency and availability; publish no SLA until measured.
- [ ] Automatic reconnect with bounded exponential backoff and clear degraded states.
- [ ] Multi-camera synchronization based on shared timecode/clock alignment; independent feeds must not be described as synchronized.
- [ ] Audio capture, rights, mixing, sync, mute controls, and accessibility validated.
- [ ] Browser compatibility and adaptive bitrate strategy verified under constrained networks.

### Product readiness
- [ ] Product UX and copy reviewed in Hebrew and English, including RTL behavior.
- [ ] User identity, account lifecycle, privacy controls, and support process defined.
- [ ] Match schedule and metadata source contracted; fixture delays/corrections handled.
- [ ] Fan interaction features (rooms, polls, predictions, moderation, reporting) implemented with persistence and abuse controls before public release.
- [ ] Analytics events and success metrics defined with privacy review.
- [ ] Accessibility review (keyboard, screen readers, contrast, captions where applicable).

## Explicitly not implemented in this repository

- Real licensed match feeds or camera hardware.
- User accounts, authentication, authorization, or persistent fan rooms.
- Match data provider integration.
- Polls, predictions, chat, moderation, rewards, or leaderboards.
- Synchronized Multi-View, Smart Camera/computer vision, or immersive audio.
- Production deployment, TURN, monitoring, scaling, backups, or incident response.

## Go/no-go rule

Do not call Matchroom production-ready or open public registration until all Release 1 legal, security, streaming, operational, and product gates have evidence attached and a real-feed pilot has passed. Passing CI alone is necessary but not sufficient.
