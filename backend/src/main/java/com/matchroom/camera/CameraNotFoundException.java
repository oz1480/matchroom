package com.matchroom.camera;

public class CameraNotFoundException extends RuntimeException {
    public CameraNotFoundException(String id) { super("Camera not found: " + id); }
}
