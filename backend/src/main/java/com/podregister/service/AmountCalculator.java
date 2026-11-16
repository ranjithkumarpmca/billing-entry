package com.podregister.service;

import com.podregister.model.Customer;
import java.util.Locale;
import java.util.Map;

/**
 * Each customer types their own rates: cover, 250 g, 500 g and 1 kg.
 * A consignment from PARCEL_FROM_GRAMS up is a parcel, anything lighter is a cover.
 *   cover      : the customer's cover rate
 *   parcel     : up to 250 g -> rate 250; up to 500 g -> rate 500; up to 1000 g -> rate 1000
 *   above 1 kg : rate 1000 + rate 250 for every extra 250 g (or part of it)
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
        if (weightGrams <= 250) return customer.getRate250();
        if (weightGrams <= 500) return customer.getRate500();
        if (weightGrams <= 1000) return customer.getRate1000();
        int extraSteps = (weightGrams - 1000 + 249) / 250; // every 250 g above 1 kg, a part counts as a whole step
        return customer.getRate1000() + extraSteps * customer.getRate250();
    }
}
