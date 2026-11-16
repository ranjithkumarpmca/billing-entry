package com.podregister.web;

/** Rates are optional: a missing rate keeps the customer's current one (or the old rate card for a new customer). */
public record CustomerRequest(String name, String place, String gstin, String address1, String address2, String city,
                              Integer coverRate, Integer rate250, Integer rate500, Integer rate1000) {}
