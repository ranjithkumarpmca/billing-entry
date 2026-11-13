package com.podregister.web;

import com.podregister.model.Customer;

public record CustomerResponse(Long id, String name, String place, String gstin,
                               int coverRate, int parcelRate, int parcelExtra, int slabGrams) {

    public static CustomerResponse from(Customer c) {
        return new CustomerResponse(c.getId(), c.getName(), c.getPlace(), c.getGstin(),
                c.getCoverRate(), c.getParcelRate(), c.getParcelExtra(), c.getSlabGrams());
    }
}
