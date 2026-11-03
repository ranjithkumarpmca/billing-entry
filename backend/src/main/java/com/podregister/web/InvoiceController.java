package com.podregister.web;

import com.podregister.service.InvoiceService;
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

    /** Gets (or creates) the invoice number for one customer and month. Same inputs always give the same number. */
    @PostMapping("/number")
    public Map<String, Object> number(@RequestParam Long customerId, @RequestParam(required = false) String month) {
        return Map.of("invoiceNo", service.numberFor(customerId, month));
    }
}
