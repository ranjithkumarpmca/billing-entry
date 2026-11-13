package com.podregister.service;

import com.podregister.model.Customer;
import java.util.Locale;
import java.util.Map;

/**
 * Each customer has their own rates.
 * A consignment from PARCEL_FROM_GRAMS up is a parcel, anything lighter is a cover.
 *   cover  : the customer's flat cover rate
 *   parcel : parcel rate for the first slab, plus the extra rate for every further slab (or part of it)
 * Bombay is a flat Rs 150 whatever the weight or customer.
 * Keep PARCEL_FROM_GRAMS and the rules in step with frontend/src/logic.js.
 */
public final class AmountCalculator {

    public static final int PARCEL_FROM_GRAMS = 250;
    private static final Map<String, Integer> FLAT_RATES = Map.of("bombay", 150);

    private AmountCalculator() {}

    public static boolean isParcel(int weightGrams) {
        return weightGrams >= PARCEL_FROM_GRAMS;
    }

    public static int amountFor(Customer customer, String destination, int weightGrams) {
        if (weightGrams < 0) {
            throw new IllegalArgumentException("Weight cannot be negative.");
        }
        Integer flat = destination == null ? null : FLAT_RATES.get(destination.trim().toLowerCase(Locale.ROOT));
        if (flat != null) {
            return flat;
        }
        if (!isParcel(weightGrams)) {
            return customer.getCoverRate();
        }
        int slab = Math.max(1, customer.getSlabGrams());
        int slabs = (weightGrams + slab - 1) / slab;
        return customer.getParcelRate() + (slabs - 1) * customer.getParcelExtra();
    }
}
