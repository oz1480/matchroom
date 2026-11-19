package com.matchroom.camera;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class CameraService {
    private final List<Camera> cameras;

    public CameraService(
        @Value("${matchroom.media.public-base-url:http://localhost:8888}") String hlsBaseUrl,
        @Value("${matchroom.media.webrtc-base-url:http://localhost:8889}") String webrtcBaseUrl
    ) {
        String hls = normalizeBase(hlsBaseUrl, "http://localhost:8888");
        String webrtc = normalizeBase(webrtcBaseUrl, "http://localhost:8889");
        cameras = List.of(
            camera("main", "Main camera", "Primary wide match view", "cam-main", 1, hls, webrtc),
            camera("behind-goal", "Behind the goal", "Goal-line perspective", "cam-behind-goal", 2, hls, webrtc),
            camera("tactical", "Tactical camera", "Elevated tactical perspective", "cam-tactical", 3, hls, webrtc)
        );
    }

    private Camera camera(String id, String name, String description, String path, int order, String hls, String webrtc) {
        return new Camera(id, name, description, hls + "/" + path + "/index.m3u8", webrtc + "/" + path + "/whep", order);
    }

    private static String normalizeBase(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.replaceAll("/+$", "");
    }

    public List<Camera> findAll() { return cameras; }

    public Camera findById(String id) {
        return cameras.stream().filter(camera -> camera.id().equals(id)).findFirst()
            .orElseThrow(() -> new CameraNotFoundException(id));
    }
}
