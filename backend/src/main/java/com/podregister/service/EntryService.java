package com.podregister.service;

import com.podregister.model.PodEntry;
import com.podregister.model.Customer;
import com.podregister.repo.CustomerRepository;
import com.podregister.repo.PodEntryRepository;
import com.podregister.web.EntryRequest;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EntryService {

    private static final Pattern POD = Pattern.compile("^\\d{10}[0-6]$");
    private static final int MAX_BATCH = 5000;

    private final PodEntryRepository repo;
    private final CustomerRepository customers;

    public EntryService(PodEntryRepository repo, CustomerRepository customers) {
        this.repo = repo;
        this.customers = customers;
    }

    /** id -> name, used for the Customer column in the Excel file. */
    @Transactional(readOnly = true)
    public Map<Long, String> customerNames() {
        return customers.findAll().stream().collect(Collectors.toMap(Customer::getId, Customer::getName));
    }

    /** The customer a bill is made for (name, place, GSTIN), or null when no single customer is chosen. */
    @Transactional(readOnly = true)
    public Customer customerOrNull(Long id) {
        if (id == null) return null;
        return customers.findById(id)
                .orElseThrow(() -> new NoSuchElementException("That customer no longer exists. Refresh the page."));
    }

    /** Rates for entries saved before customers existed (the old rate card). */
    private static Customer defaultRates() {
        return new Customer();
    }

    /** Checks one request and copies it into the entry. The amount is always calculated here, never taken from the browser. */
    private void fill(PodEntry e, EntryRequest r, String where, Customer customer) {
        String pod = r.podNumber() == null ? "" : r.podNumber().trim();
        if (!POD.matcher(pod).matches()) {
            throw new IllegalArgumentException(where + "POD number must be 11 digits and end with 0 to 6.");
        }
        if (r.entryDate() == null) {
            throw new IllegalArgumentException(where + "date is missing.");
        }
        String destination = r.destination() == null ? "" : r.destination().trim();
        if (destination.isEmpty() || destination.length() > 100) {
            throw new IllegalArgumentException(where + "destination is missing.");
        }
        if (r.weightGrams() == null || r.weightGrams() < 0 || r.weightGrams() > 1_000_000) {
            throw new IllegalArgumentException(where + "weight cannot be negative.");
        }
        e.setPodNumber(pod);
        e.setEntryDate(r.entryDate());
        e.setDestination(destination);
        e.setWeightGrams(r.weightGrams());
        e.setAmount(AmountCalculator.amountFor(customer, destination, r.weightGrams()));
    }

    /** Saves all rows or none. */
    @Transactional
    public int saveAll(List<EntryRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            throw new IllegalArgumentException("There are no entries to save.");
        }
        if (requests.size() > MAX_BATCH) {
            throw new IllegalArgumentException("Save at most " + MAX_BATCH + " entries at a time.");
        }

        Set<String> seen = new LinkedHashSet<>();
        List<String> repeated = new ArrayList<>();
        List<PodEntry> toSave = new ArrayList<>();
        Map<Long, Customer> known = new java.util.HashMap<>();
        int row = 0;

        for (EntryRequest r : requests) {
            row++;
            PodEntry e = new PodEntry();
            if (r.customerId() == null) {
                throw new IllegalArgumentException("Row " + row + ": choose a customer.");
            }
            Customer customer = known.get(r.customerId());
            if (customer == null) {
                customer = customers.findById(r.customerId())
                        .orElseThrow(() -> new IllegalArgumentException("That customer no longer exists. Refresh the page."));
                known.put(r.customerId(), customer);
            }
            fill(e, r, "Row " + row + ": ", customer);
            e.setCustomerId(r.customerId());
            if (!seen.add(e.getPodNumber())) {
                repeated.add(e.getPodNumber());
                continue;
            }
            toSave.add(e);
        }

        if (!repeated.isEmpty()) {
            throw new DuplicatePodException(repeated);
        }
        List<String> existing = repo.findExisting(seen);
        if (!existing.isEmpty()) {
            throw new DuplicatePodException(existing);
        }

        repo.saveAll(toSave);
        return toSave.size();
    }

    /** Edits one saved entry. */
    @Transactional
    public PodEntry update(Long id, EntryRequest request) {
        PodEntry existing = repo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("This entry no longer exists. Refresh the list."));

        // Validate into a temporary object first, so nothing is flushed to the database if a check fails.
        Long customerId = request.customerId() != null ? request.customerId() : existing.getCustomerId();
        Customer customer = customerId == null ? defaultRates()
                : customers.findById(customerId)
                        .orElseThrow(() -> new IllegalArgumentException("That customer no longer exists. Refresh the page."));
        PodEntry checked = new PodEntry();
        fill(checked, request, "", customer);
        if (repo.existsByPodNumberAndIdNot(checked.getPodNumber(), id)) {
            throw new DuplicatePodException(List.of(checked.getPodNumber()));
        }
        // Only the POD number or date changed: keep the amount already billed, even if the customer's rates changed since.
        boolean sameBilling = existing.getWeightGrams() == checked.getWeightGrams()
                && existing.getDestination().equalsIgnoreCase(checked.getDestination())
                && java.util.Objects.equals(existing.getCustomerId(), customerId);
        if (sameBilling) {
            checked.setAmount(existing.getAmount());
        }

        existing.setPodNumber(checked.getPodNumber());
        existing.setEntryDate(checked.getEntryDate());
        existing.setDestination(checked.getDestination());
        existing.setWeightGrams(checked.getWeightGrams());
        existing.setAmount(checked.getAmount());
        if (request.customerId() != null) {
            existing.setCustomerId(request.customerId());
        }
        return repo.save(existing);
    }

    @Transactional
    public void delete(Long id) {
        if (!repo.existsById(id)) {
            throw new NoSuchElementException("This entry no longer exists. Refresh the list.");
        }
        repo.deleteById(id);
    }

    /** Deletes every entry that the same filter would list. Returns how many were deleted. */
    @Transactional
    public int deleteMatching(LocalDate from, LocalDate to, String search, Long customerId) {
        List<PodEntry> list = find(from, to, search, customerId);
        repo.deleteAll(list);
        return list.size();
    }

    /** from and to are days, both included; a blank one means no limit on that side. search matches POD number or destination. */
    @Transactional(readOnly = true)
    public List<PodEntry> find(LocalDate from, LocalDate to, String search, Long customerId) {
        LocalDate a = from == null ? LocalDate.of(1900, 1, 1) : from;
        LocalDate b = to == null ? LocalDate.of(2999, 12, 31) : to;
        if (a.isAfter(b)) {
            throw new IllegalArgumentException("The From date is after the To date.");
        }
        List<PodEntry> list = repo.findBetween(a, b);
        if (customerId != null) {
            list = list.stream().filter(e -> customerId.equals(e.getCustomerId())).toList();
        }
        if (search == null || search.isBlank()) {
            return list;
        }
        String q = search.trim().toLowerCase(Locale.ROOT);
        return list.stream()
                .filter(e -> e.getPodNumber().contains(q) || e.getDestination().toLowerCase(Locale.ROOT).contains(q))
                .toList();
    }
}
