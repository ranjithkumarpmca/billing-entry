package com.podregister.web;

import com.podregister.service.AuthService;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public static final String COOKIE = "POD_SESSION";

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    public record PinBody(String pin) {}

    @GetMapping("/status")
    public Map<String, Object> status(@CookieValue(value = COOKIE, required = false) String token) {
        Optional<String> role = auth.roleOf(token);
        return Map.<String, Object>of("role", role.orElse(""));
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody PinBody body, HttpServletResponse res) {
        Optional<AuthService.Result> r = auth.login(body.pin());
        if (r.isEmpty()) {
            return ResponseEntity.status(401).body(Map.<String, Object>of("message", "That password is not correct."));
        }
        res.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(COOKIE, r.get().token()).httpOnly(true).sameSite("Strict").path("/").build().toString());
        return ResponseEntity.ok(Map.<String, Object>of("role", r.get().role()));
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(@CookieValue(value = COOKIE, required = false) String token, HttpServletResponse res) {
        auth.logout(token);
        res.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(COOKIE, "").httpOnly(true).sameSite("Strict").path("/").maxAge(0).build().toString());
        return Map.of("ok", true);
    }
}
