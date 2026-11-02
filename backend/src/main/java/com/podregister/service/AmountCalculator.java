package com.podregister.service;

import java.util.Locale;
import java.util.Map;

/**
 * Tamil Nadu rate: Rs 25 up to 300 g, plus Rs 7 for every further 300 g (or part of it).
 * Bombay is a flat Rs 150 whatever the weight.
 */
public final class AmountCalculator {

    public static final int BASE = 25;
    public static final int STEP = 7;
    public static final int SLAB_GRAMS = 300;
    private static final Map<String, Integer> FLAT_RATES = Map.of("bombay", 150);

    private AmountCalculator() {}

    public static int amountFor(String destination, int weightGrams) {
        if (weightGrams <= 0) {
            throw new IllegalArgumentException("Weight must be more than 0 grams.");
        }
        Integer flat = destination == null ? null : FLAT_RATES.get(destination.trim().toLowerCase(Locale.ROOT));
        if (flat != null) {
            return flat;
        }
        int slabs = (weightGrams + SLAB_GRAMS - 1) / SLAB_GRAMS;
        return BASE + (slabs - 1) * STEP;
    }
}
