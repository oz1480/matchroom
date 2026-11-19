package com.matchroom.camera;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cameras")
public class CameraController {
    private final CameraService cameraService;
    public CameraController(CameraService cameraService) { this.cameraService = cameraService; }

    @GetMapping
    public List<Camera> getCameras() { return cameraService.findAll(); }

    @GetMapping("/{id}")
    public Camera getCamera(@PathVariable String id) { return cameraService.findById(id); }

    @ExceptionHandler(CameraNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> handleNotFound(CameraNotFoundException exception) {
        return Map.of("error", exception.getMessage());
    }
}
