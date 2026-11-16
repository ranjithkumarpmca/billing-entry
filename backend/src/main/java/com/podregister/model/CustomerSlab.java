package com.podregister.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** One parcel price of a customer: a parcel up to upToGrams costs price. */
@Entity
@Table(name = "customer_slab")
public class CustomerSlab {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(name = "up_to_grams", nullable = false)
    private int upToGrams;

    @Column(name = "price", nullable = false)
    private int price;

    protected CustomerSlab() {}

    public CustomerSlab(Customer customer, int upToGrams, int price) {
        this.customer = customer;
        this.upToGrams = upToGrams;
        this.price = price;
    }

    public Long getId() { return id; }
    public Customer getCustomer() { return customer; }
    public int getUpToGrams() { return upToGrams; }
    public int getPrice() { return price; }
}
