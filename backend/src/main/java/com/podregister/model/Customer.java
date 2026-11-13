package com.podregister.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "customer")
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "place", nullable = false, length = 100)
    private String place = "";

    @Column(name = "gstin", nullable = false, length = 20)
    private String gstin = "";

    @Column(name = "cover_rate", nullable = false)
    private int coverRate = 25;

    @Column(name = "parcel_rate", nullable = false)
    private int parcelRate = 25;

    @Column(name = "parcel_extra", nullable = false)
    private int parcelExtra = 7;

    @Column(name = "slab_grams", nullable = false)
    private int slabGrams = 300;

    public Long getId() { return id; }
    public int getCoverRate() { return coverRate; }
    public void setCoverRate(int coverRate) { this.coverRate = coverRate; }
    public int getParcelRate() { return parcelRate; }
    public void setParcelRate(int parcelRate) { this.parcelRate = parcelRate; }
    public int getParcelExtra() { return parcelExtra; }
    public void setParcelExtra(int parcelExtra) { this.parcelExtra = parcelExtra; }
    public int getSlabGrams() { return slabGrams; }
    public void setSlabGrams(int slabGrams) { this.slabGrams = slabGrams; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getPlace() { return place; }
    public void setPlace(String place) { this.place = place; }
    public String getGstin() { return gstin; }
    public void setGstin(String gstin) { this.gstin = gstin; }
}
