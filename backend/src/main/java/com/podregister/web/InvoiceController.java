package com.podregister.web;

import com.podregister.service.InvoiceService;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/invoices")
public class InvoiceController {

    private final InvoiceService service;

    public InvoiceController(InvoiceService service) {
        this.service = service;
    }

    /** Gets (or creates) the invoice number for one customer and date range. Same inputs always give the same number. */
    @PostMapping("/number")
    public Map<String, Object> number(@RequestParam Long customerId,
                                      @RequestParam(required = false) String from,
                                      @RequestParam(required = false) String to) {
        return Map.of("invoiceNo", service.numberFor(customerId, day(from), day(to)));
    }

    private static LocalDate day(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDate.parse(s.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Date must be in yyyy-mm-dd form.");
        }
    }
}
