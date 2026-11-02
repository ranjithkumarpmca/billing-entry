package com.podregister.service;

import java.util.List;

public class DuplicatePodException extends RuntimeException {

    private final List<String> podNumbers;

    public DuplicatePodException(List<String> podNumbers) {
        super(podNumbers.size() + " POD number(s) already saved or repeated.");
        this.podNumbers = podNumbers;
    }

    public List<String> getPodNumbers() { return podNumbers; }
}
