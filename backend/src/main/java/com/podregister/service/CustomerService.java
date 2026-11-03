package com.podregister.service;

import com.podregister.model.Customer;
import com.podregister.repo.CustomerRepository;
import com.podregister.repo.PodEntryRepository;
import com.podregister.web.CustomerRequest;
import java.util.List;
import java.util.Locale;
import java.util.NoSuchElementException;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerService {

    private static final Pattern GSTIN = Pattern.compile("^[0-9A-Z]{15}$");

    private final CustomerRepository repo;
    private final PodEntryRepository entries;

    public CustomerService(CustomerRepository repo, PodEntryRepository entries) {
        this.repo = repo;
        this.entries = entries;
    }

    @Transactional(readOnly = true)
    public List<Customer> list() {
        return repo.findAllByOrderByNameAsc();
    }

    @Transactional
    public Customer create(CustomerRequest r) {
        Customer c = new Customer();
        fill(c, r, null);
        return repo.save(c);
    }

    @Transactional
    public Customer update(Long id, CustomerRequest r) {
        Customer c = repo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("This customer no longer exists. Refresh the list."));
        fill(c, r, id);
        return repo.save(c);
    }

    @Transactional
    public void delete(Long id) {
        if (!repo.existsById(id)) {
            throw new NoSuchElementException("This customer no longer exists. Refresh the list.");
        }
        long n = entries.countByCustomerId(id);
        if (n > 0) {
            throw new IllegalArgumentException("This customer has " + n + " entries. Delete those entries first.");
        }
        repo.deleteById(id);
    }

    /** Checks everything first, and only then changes the customer. */
    private void fill(Customer c, CustomerRequest r, Long selfId) {
        String name = r.name() == null ? "" : r.name().trim();
        String place = r.place() == null ? "" : r.place().trim();
        String gstin = r.gstin() == null ? "" : r.gstin().trim().toUpperCase(Locale.ROOT);
        if (name.isEmpty() || name.length() > 150) {
            throw new IllegalArgumentException("Customer name is required.");
        }
        if (place.length() > 100) {
            throw new IllegalArgumentException("Place is too long.");
        }
        if (!gstin.isEmpty() && !GSTIN.matcher(gstin).matches()) {
            throw new IllegalArgumentException("GSTIN must be 15 letters and digits.");
        }
        boolean taken = selfId == null ? repo.existsByNameIgnoreCase(name) : repo.existsByNameIgnoreCaseAndIdNot(name, selfId);
        if (taken) {
            throw new IllegalArgumentException("A customer named \"" + name + "\" already exists.");
        }
        c.setName(name);
        c.setPlace(place);
        c.setGstin(gstin);
    }
}
