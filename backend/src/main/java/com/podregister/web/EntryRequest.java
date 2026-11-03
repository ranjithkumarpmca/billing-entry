package com.podregister.web;

import java.time.LocalDate;

public record EntryRequest(String podNumber, LocalDate entryDate, String destination, Integer weightGrams, Long customerId) {}
