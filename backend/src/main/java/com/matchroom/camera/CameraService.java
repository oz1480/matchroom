package com.matchroom.camera;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class CameraService {
    private final List<Camera> cameras;

    public CameraService(@Value("${matchroom.media.public-base-url:http://localhost:8888}") String mediaBaseUrl) {
        String base = mediaBaseUrl == null || mediaBaseUrl.isBlank()
                ? "http://localhost:8888" : mediaBaseUrl.replaceAll("/+$", "");
        cameras = List.of(
            new Camera("main", "Main camera", "Primary wide match view", base + "/cam-main/index.m3u8", 1),
            new Camera("behind-goal", "Behind the goal", "Goal-line perspective", base + "/cam-behind-goal/index.m3u8", 2),
            new Camera("tactical", "Tactical camera", "Elevated tactical perspective", base + "/cam-tactical/index.m3u8", 3)
        );
    }

    public List<Camera> findAll() { return cameras; }

    public Camera findById(String id) {
        return cameras.stream().filter(camera -> camera.id().equals(id)).findFirst()
            .orElseThrow(() -> new CameraNotFoundException(id));
    }
}
