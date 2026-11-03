package com.podregister.web;

import com.podregister.model.PodEntry;
import java.time.LocalDate;

public record EntryResponse(Long id, String podNumber, LocalDate entryDate, String destination, int weightGrams, int amount, Long customerId) {

    public static EntryResponse from(PodEntry e) {
        return new EntryResponse(e.getId(), e.getPodNumber(), e.getEntryDate(), e.getDestination(), e.getWeightGrams(), e.getAmount(), e.getCustomerId());
    }
}
