package com.podregister.service;

import com.podregister.model.Customer;
import com.podregister.model.PodEntry;
import com.podregister.repo.CustomerRepository;
import com.podregister.repo.PodEntryRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.TreeMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dashboard numbers, straight from the entries in Records.
 * A customer is "billed" when it has at least one entry (no Print needed).
 * amount   = total of all the customer's entries.
 * billedTo = date of the customer's latest entry (null when none).
 */
@Service
public class DashboardService {

    private final CustomerRepository customers;
    private final PodEntryRepository entries;

    public DashboardService(CustomerRepository customers, PodEntryRepository entries) {
        this.customers = customers;
        this.entries = entries;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> customerCards() {
        Map<Long, Long> totals = new HashMap<>();
        Map<Long, LocalDate> latest = new HashMap<>();
        for (PodEntry e : entries.findAllOrdered()) {
            totals.merge(e.getCustomerId(), (long) e.getAmount(), Long::sum);
            latest.merge(e.getCustomerId(), e.getEntryDate(), (a, b) -> a.isAfter(b) ? a : b);
        }

        List<Map<String, Object>> out = new ArrayList<>();
        for (Customer c : customers.findAllByOrderByNameAsc()) {
            Long amount = totals.get(c.getId());
            boolean billed = amount != null;
            Map<String, Object> card = new LinkedHashMap<>();
            card.put("id", c.getId());
            card.put("name", c.getName());
            card.put("amount", billed ? amount : 0L);
            card.put("billed", billed);
            card.put("billedTo", billed ? latest.get(c.getId()).toString() : null);
            out.add(card);
        }
        return out;
    }

    /** Amount per month across all customers, oldest month first. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> monthlyAll() {
        return byMonth(null);
    }

    /** Amount per month for one customer, oldest month first. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> monthly(Long customerId) {
        if (!customers.existsById(customerId)) {
            throw new NoSuchElementException("That customer no longer exists.");
        }
        return byMonth(customerId);
    }

    private List<Map<String, Object>> byMonth(Long customerId) {
        TreeMap<String, Long> totals = new TreeMap<>();
        for (PodEntry e : entries.findAllOrdered()) {
            if (customerId != null && !customerId.equals(e.getCustomerId())) continue;
            LocalDate d = e.getEntryDate();
            String month = d.getYear() + "-" + String.format("%02d", d.getMonthValue());
            totals.merge(month, (long) e.getAmount(), Long::sum);
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map.Entry<String, Long> m : totals.entrySet()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("month", m.getKey());
            row.put("amount", m.getValue());
            out.add(row);
        }
        return out;
    }
}