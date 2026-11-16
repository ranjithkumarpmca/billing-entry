package com.podregister.web;

import com.podregister.model.Customer;
import com.podregister.model.PodEntry;
import com.podregister.service.EntryService;
import com.podregister.service.ExcelExporter;
import com.podregister.service.InvoiceService;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/entries")
public class EntryController {

    private static final MediaType XLSX =
            MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final EntryService service;
    private final InvoiceService invoices;

    public EntryController(EntryService service, InvoiceService invoices) {
        this.service = service;
        this.invoices = invoices;
    }

    @PostMapping("/bulk")
    public ResponseEntity<Map<String, Object>> saveBulk(@RequestBody BulkRequest body) {
        int saved = service.saveAll(body.entries());
        return ResponseEntity.status(201).body(Map.of("saved", saved));
    }

    /** A yyyy-MM-dd date from the page, or null when blank. */
    static LocalDate day(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDate.parse(s.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("Date must be in yyyy-mm-dd form.");
        }
    }

    @GetMapping
    public List<EntryResponse> list(@RequestParam(required = false) String from,
                                    @RequestParam(required = false) String to,
                                    @RequestParam(required = false) String search,
                                    @RequestParam(required = false) Long customerId) {
        return service.find(day(from), day(to), search, customerId).stream().map(EntryResponse::from).toList();
    }

    @PutMapping("/{id}")
    public EntryResponse update(@PathVariable Long id, @RequestBody EntryRequest body) {
        return EntryResponse.from(service.update(id, body));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Deletes everything the same month/search filter lists. */
    @DeleteMapping
    public Map<String, Object> deleteMatching(@RequestParam(required = false) String from,
                                              @RequestParam(required = false) String to,
                                              @RequestParam(required = false) String search,
                                              @RequestParam(required = false) Long customerId) {
        return Map.of("deleted", service.deleteMatching(day(from), day(to), search, customerId));
    }

    @GetMapping("/export.xlsx")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) String from,
                                         @RequestParam(required = false) String to,
                                         @RequestParam(required = false) String search,
                                         @RequestParam(required = false) Long customerId) throws IOException {
        List<PodEntry> entries = service.find(day(from), day(to), search, customerId);
        // One customer chosen: the file is that customer's bill and carries the same invoice number as the printed one.
        Customer customer = service.customerOrNull(customerId);
        Long invoiceNo = customer == null ? null : invoices.numberFor(customerId, day(from), day(to));
        byte[] file = ExcelExporter.build(entries, service.customerNames(), customer, day(from), day(to), invoiceNo);
        String label = (day(from) == null && day(to) == null) ? "all" : day(from) + "_to_" + day(to);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(XLSX);
        headers.setContentDisposition(ContentDisposition.attachment().filename("pod-register-" + label + ".xlsx").build());
        return ResponseEntity.ok().headers(headers).body(file);
    }
}
