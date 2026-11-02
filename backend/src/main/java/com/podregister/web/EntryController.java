package com.podregister.web;

import com.podregister.model.PodEntry;
import com.podregister.service.EntryService;
import com.podregister.service.ExcelExporter;
import java.io.IOException;
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

    public EntryController(EntryService service) {
        this.service = service;
    }

    @PostMapping("/bulk")
    public ResponseEntity<Map<String, Object>> saveBulk(@RequestBody BulkRequest body) {
        int saved = service.saveAll(body.entries());
        return ResponseEntity.status(201).body(Map.of("saved", saved));
    }

    @GetMapping
    public List<EntryResponse> list(@RequestParam(required = false) String month,
                                    @RequestParam(required = false) String search) {
        return service.find(month, search).stream().map(EntryResponse::from).toList();
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
    public Map<String, Object> deleteMatching(@RequestParam(required = false) String month,
                                              @RequestParam(required = false) String search) {
        return Map.of("deleted", service.deleteMatching(month, search));
    }

    @GetMapping("/export.xlsx")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) String month,
                                         @RequestParam(required = false) String search) throws IOException {
        List<PodEntry> entries = service.find(month, search);
        byte[] file = ExcelExporter.build(entries);
        String label = (month == null || month.isBlank()) ? "all" : month.trim();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(XLSX);
        headers.setContentDisposition(ContentDisposition.attachment().filename("pod-register-" + label + ".xlsx").build());
        return ResponseEntity.ok().headers(headers).body(file);
    }
}
