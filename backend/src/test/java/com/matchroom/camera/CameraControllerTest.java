package com.matchroom.camera;

import com.matchroom.MatchroomApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = MatchroomApplication.class)
@AutoConfigureMockMvc
class CameraControllerTest {
    @Autowired MockMvc mockMvc;

    @Test
    void listsThreeConfiguredCamerasWithBothPlaybackProtocols() throws Exception {
        mockMvc.perform(get("/api/cameras"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(3)))
            .andExpect(jsonPath("$[0].id", is("main")))
            .andExpect(jsonPath("$[0].hlsUrl", is("http://localhost:8888/cam-main/index.m3u8")))
            .andExpect(jsonPath("$[0].whepUrl", is("http://localhost:8889/cam-main/whep")));
    }

    @Test
    void returnsCameraDetailsById() throws Exception {
        mockMvc.perform(get("/api/cameras/behind-goal"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name", is("Behind the goal")))
            .andExpect(jsonPath("$.whepUrl", is("http://localhost:8889/cam-behind-goal/whep")));
    }

    @Test
    void unknownCameraReturns404() throws Exception {
        mockMvc.perform(get("/api/cameras/not-real"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.error", is("Camera not found: not-real")));
    }

    @Test
    void actuatorHealthIsExposed() throws Exception {
        mockMvc.perform(get("/actuator/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("UP")));
    }
}
