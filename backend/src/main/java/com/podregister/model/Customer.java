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

    @Column(name = "address1", nullable = false, length = 150)
    private String address1 = "";

    @Column(name = "address2", nullable = false, length = 150)
    private String address2 = "";

    @Column(name = "city", nullable = false, length = 150)
    private String city = "";

    @Column(name = "cover_rate", nullable = false)
    private int coverRate = 25;

    @Column(name = "rate_250", nullable = false)
    private int rate250 = 25;

    @Column(name = "rate_500", nullable = false)
    private int rate500 = 32;

    @Column(name = "rate_1000", nullable = false)
    private int rate1000 = 46;

    public Long getId() { return id; }
    public int getCoverRate() { return coverRate; }
    public void setCoverRate(int coverRate) { this.coverRate = coverRate; }
    public int getRate250() { return rate250; }
    public void setRate250(int rate250) { this.rate250 = rate250; }
    public int getRate500() { return rate500; }
    public void setRate500(int rate500) { this.rate500 = rate500; }
    public int getRate1000() { return rate1000; }
    public void setRate1000(int rate1000) { this.rate1000 = rate1000; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getPlace() { return place; }
    public void setPlace(String place) { this.place = place; }
    public String getGstin() { return gstin; }
    public void setGstin(String gstin) { this.gstin = gstin; }
    public String getAddress1() { return address1; }
    public void setAddress1(String address1) { this.address1 = address1; }
    public String getAddress2() { return address2; }
    public void setAddress2(String address2) { this.address2 = address2; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
}
