package com.podregister.web;

/** Rates are optional: a missing rate keeps the customer's current one (or the old rate card for a new customer). */
public record CustomerRequest(String name, String place, String gstin,
                              Integer coverRate, Integer parcelRate, Integer parcelExtra, Integer slabGrams) {}
