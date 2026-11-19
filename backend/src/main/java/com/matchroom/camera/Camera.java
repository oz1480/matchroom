package com.matchroom.camera;

public record Camera(
    String id,
    String name,
    String description,
    String hlsUrl,
    String whepUrl,
    int order
) {}
