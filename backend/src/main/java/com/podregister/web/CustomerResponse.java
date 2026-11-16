package com.podregister.web;

import com.podregister.model.Customer;

public record CustomerResponse(Long id, String name, String place, String gstin, String address1, String address2, String city,
                               int coverRate, int rate250, int rate500, int rate1000) {

    public static CustomerResponse from(Customer c) {
        return new CustomerResponse(c.getId(), c.getName(), c.getPlace(), c.getGstin(),
                c.getAddress1(), c.getAddress2(), c.getCity(),
                c.getCoverRate(), c.getRate250(), c.getRate500(), c.getRate1000());
    }
}
