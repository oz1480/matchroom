package com.matchroom.camera;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CameraServiceTest {
    @Test
    void trimsBaseUrlSlashesAndBuildsBothPlaybackUrls() {
        CameraService service = new CameraService(
            "https://media.example/hls///",
            "https://media.example/webrtc/"
        );

        Camera camera = service.findById("main");

        assertEquals("https://media.example/hls/cam-main/index.m3u8", camera.hlsUrl());
        assertEquals("https://media.example/webrtc/cam-main/whep", camera.whepUrl());
    }

    @Test
    void providesExactlyThreeCameraAngles() {
        CameraService service = new CameraService("http://localhost:8888", "http://localhost:8889");

        assertEquals(3, service.findAll().size());
        assertEquals("tactical", service.findAll().get(2).id());
    }
}
