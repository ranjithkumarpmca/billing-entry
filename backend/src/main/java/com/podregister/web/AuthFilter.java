package com.podregister.web;

import com.podregister.service.AuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Every /api call except /api/auth/* needs a live login. BILLER cannot change customers or rates. */
@Component
public class AuthFilter extends OncePerRequestFilter {

    private final AuthService auth;

    public AuthFilter(AuthService auth) {
        this.auth = auth;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        String path = req.getRequestURI();
        return !path.startsWith("/api/") || path.startsWith("/api/auth/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String token = null;
        if (req.getCookies() != null) {
            for (Cookie c : req.getCookies()) {
                if (AuthController.COOKIE.equals(c.getName())) {
                    token = c.getValue();
                }
            }
        }
        Optional<String> role = auth.roleOf(token);
        if (role.isEmpty()) {
            send(res, 401, "Enter your password to continue.");
            return;
        }
        boolean changesCustomers = !"GET".equalsIgnoreCase(req.getMethod()) && req.getRequestURI().startsWith("/api/customers");
        if (AuthService.BILLER.equals(role.get()) && changesCustomers) {
            send(res, 403, "Customer and rate changes are not allowed for this login.");
            return;
        }
        chain.doFilter(req, res);
    }

    private void send(HttpServletResponse res, int status, String message) throws IOException {
        res.setStatus(status);
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
