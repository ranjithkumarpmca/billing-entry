package com.podregister.service;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Two logins share one screen: ADMIN (full access) and BILLER (no customer or rate changes).
 * Default PINs are stored in the database the first time the program starts. Existing PINs are never overwritten.
 * Sessions live in memory, so a restart of the program asks for the PIN again.
 */
@Service
public class AuthService {

    public static final String ADMIN = "ADMIN";
    public static final String BILLER = "BILLER";
    public static final Duration IDLE_LIMIT = Duration.ofMinutes(15);

    // Default PINs used only when the database has none yet. Letters and digits, 4 to 8 characters.
    private static final String DEFAULT_ADMIN_PIN = "admin";
    private static final String DEFAULT_BILLER_PIN = "bill";

    private static final int ITERATIONS = 120_000;
    private static final int MAX_WRONG = 3;
    private static final Duration LOCK_FOR = Duration.ofSeconds(60);

    public record Result(String token, String role) {}

    private static final class Session {
        final String role;
        volatile Instant lastSeen = Instant.now();

        Session(String role) {
            this.role = role;
        }
    }

    private final JdbcTemplate jdbc;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Session> sessions = new ConcurrentHashMap<>();
    private int wrongTries;
    private Instant lockedUntil = Instant.EPOCH;

    public AuthService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void seedDefaultPins() {
        insertIfMissing(ADMIN, DEFAULT_ADMIN_PIN);
        insertIfMissing(BILLER, DEFAULT_BILLER_PIN);
    }

    /** Returns empty when the PIN is wrong. */
    public synchronized Optional<Result> login(String pin) {
        checkLockout();
        String role = matchPin(pin);
        if (role == null) {
            wrongTries++;
            if (wrongTries >= MAX_WRONG) {
                wrongTries = 0;
                lockedUntil = Instant.now().plus(LOCK_FOR);
                // Show the lock message on the same wrong attempt that triggers it.
                throw new IllegalArgumentException("Too many wrong passwords. Wait a minute and try again.");
            }
            return Optional.empty();
        }
        wrongTries = 0;
        return Optional.of(new Result(newSession(role), role));
    }

    /** Returns the role for a live session, or empty if the session is unknown or idle too long. */
    public Optional<String> roleOf(String token) {
        if (token == null) {
            return Optional.empty();
        }
        Session s = sessions.get(token);
        if (s == null) {
            return Optional.empty();
        }
        if (Duration.between(s.lastSeen, Instant.now()).compareTo(IDLE_LIMIT) > 0) {
            sessions.remove(token);
            return Optional.empty();
        }
        s.lastSeen = Instant.now();
        return Optional.of(s.role);
    }

    public void logout(String token) {
        if (token != null) {
            sessions.remove(token);
        }
    }

    private String newSession(String role) {
        String token = UUID.randomUUID() + "-" + UUID.randomUUID();
        sessions.put(token, new Session(role));
        return token;
    }

    private void checkLockout() {
        if (Instant.now().isBefore(lockedUntil)) {
            throw new IllegalArgumentException("Too many wrong passwords. Wait a minute and try again.");
        }
    }

    private String matchPin(String pin) {
        if (pin == null || pin.isBlank()) {
            return null;
        }
        for (String role : List.of(ADMIN, BILLER)) {
            String stored = storedHash(role);
            if (stored != null && verify(pin, stored)) {
                return role;
            }
        }
        return null;
    }

    private String storedHash(String role) {
        List<String> rows = jdbc.queryForList("SELECT secret_hash FROM app_auth WHERE role = ?", String.class, role);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private void insertIfMissing(String role, String pin) {
        jdbc.update("INSERT INTO app_auth (role, secret_hash) VALUES (?, ?) ON CONFLICT (role) DO NOTHING", role, hash(pin));
    }

    private String hash(String secret) {
        byte[] salt = new byte[16];
        random.nextBytes(salt);
        return "pbkdf2$" + ITERATIONS + "$" + Base64.getEncoder().encodeToString(salt) + "$"
                + Base64.getEncoder().encodeToString(derive(secret, salt, ITERATIONS));
    }

    private boolean verify(String secret, String stored) {
        String[] parts = stored.split("\\$");
        int iterations = Integer.parseInt(parts[1]);
        byte[] salt = Base64.getDecoder().decode(parts[2]);
        byte[] want = Base64.getDecoder().decode(parts[3]);
        return MessageDigest.isEqual(want, derive(secret, salt, iterations));
    }

    private static byte[] derive(String secret, byte[] salt, int iterations) {
        try {
            PBEKeySpec spec = new PBEKeySpec(secret.toCharArray(), salt, iterations, 256);
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } catch (Exception e) {
            throw new IllegalStateException("Could not check the PIN.", e);
        }
    }
}