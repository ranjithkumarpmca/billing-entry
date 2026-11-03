package com.podregister.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;

@Entity
@Table(name = "pod_entry")
public class PodEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "pod_number", nullable = false, unique = true, length = 11)
    private String podNumber;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    @Column(name = "destination", nullable = false, length = 100)
    private String destination;

    @Column(name = "weight_grams", nullable = false)
    private int weightGrams;

    @Column(name = "amount", nullable = false)
    private int amount;

    @Column(name = "customer_id")
    private Long customerId;

    public Long getId() { return id; }
    public Long getCustomerId() { return customerId; }
    public void setCustomerId(Long customerId) { this.customerId = customerId; }
    public String getPodNumber() { return podNumber; }
    public void setPodNumber(String podNumber) { this.podNumber = podNumber; }
    public LocalDate getEntryDate() { return entryDate; }
    public void setEntryDate(LocalDate entryDate) { this.entryDate = entryDate; }
    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }
    public int getWeightGrams() { return weightGrams; }
    public void setWeightGrams(int weightGrams) { this.weightGrams = weightGrams; }
    public int getAmount() { return amount; }
    public void setAmount(int amount) { this.amount = amount; }
}
