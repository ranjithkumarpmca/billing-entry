package com.podregister.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hands out invoice numbers: a plain running serial (1, 2, 3 ...).
 * The same customer + same period always gets the same number back, so printing a bill twice
 * (or printing and then downloading Excel) never uses up a second number.
 */
@Service
public class InvoiceService {

    @PersistenceContext
    private EntityManager em;

    /** The period is the date range, for example "2026-09-01..2026-11-30". No dates at all gives "all". */
    public static String periodKey(LocalDate from, LocalDate to) {
        if (from == null && to == null) {
            return "all";
        }
        return (from == null ? "start" : from.toString()) + ".." + (to == null ? "end" : to.toString());
    }

    @Transactional
    public long numberFor(Long customerId, LocalDate from, LocalDate to) {
        if (customerId == null) {
            throw new IllegalArgumentException("Pick one customer to get an invoice number.");
        }
        String period = periodKey(from, to);

        Long existing = find(customerId, period);
        if (existing != null) {
            return existing; // already has a number: reuse it, the serial does not move
        }

        Number customerRows = (Number) em.createNativeQuery("SELECT count(*) FROM customer WHERE id = :c")
                .setParameter("c", customerId)
                .getSingleResult();
        if (customerRows.longValue() == 0) {
            throw new IllegalArgumentException("That customer no longer exists. Refresh the page.");
        }

        // The number is only taken from the sequence here, when there is really a new bill to number.
        // ON CONFLICT covers two requests racing for the same customer + period.
        em.createNativeQuery("INSERT INTO invoice (invoice_no, customer_id, period) "
                        + "VALUES (nextval('invoice_no_seq'), :c, :p) ON CONFLICT (customer_id, period) DO NOTHING")
                .setParameter("c", customerId)
                .setParameter("p", period)
                .executeUpdate();

        Long created = find(customerId, period);
        if (created == null) {
            throw new IllegalStateException("Could not create the invoice number. Try again.");
        }
        return created;
    }

    private Long find(Long customerId, String period) {
        @SuppressWarnings("unchecked")
        List<Number> found = em.createNativeQuery("SELECT invoice_no FROM invoice WHERE customer_id = :c AND period = :p")
                .setParameter("c", customerId)
                .setParameter("p", period)
                .getResultList();
        return found.isEmpty() ? null : found.get(0).longValue();
    }
}
