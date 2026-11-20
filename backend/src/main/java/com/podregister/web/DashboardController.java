package com.podregister.web;

import com.podregister.service.DashboardService;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    /** One card per customer: total of its billed entries, and the end date of its latest bill. */
    @GetMapping("/customers")
    public List<Map<String, Object>> customers() {
        return service.customerCards();
    }

    /** Billed amount per month, all customers together (for the bar chart). */
    @GetMapping("/monthly")
    public List<Map<String, Object>> monthlyAll() {
        return service.monthlyAll();
    }

    /** Month-wise billed amount for one customer. */
    @GetMapping("/customers/{id}/monthly")
    public List<Map<String, Object>> monthly(@PathVariable Long id) {
        return service.monthly(id);
    }
}