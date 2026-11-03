package com.podregister.service;

import com.podregister.model.Customer;
import com.podregister.model.PodEntry;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.sql.Date;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.PrintSetup;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/** Builds the Excel file so it looks like the printed bill: agency header on top, GST totals and signature at the bottom. */
public final class ExcelExporter {

    // Agency details and GST rate. Keep in step with frontend/src/invoice.js.
    private static final String SELLER_NAME = "G.P.AGENCY";
    private static final String SELLER_ADDRESS = "NO.205 N.M.S COMPOUND.ERODE.1";
    private static final String SELLER_GSTIN = "33BAGPP6715GIZQ";
    private static final String SIGN_FOR = "G.P Agency";
    private static final String SIGN_TITLE = "Proprietor";
    private static final int GST_RATE = 9; // percent, charged twice: CGST and SGST

    private static final String[] HEADERS = {"S.No", "Date", "POD Number", "Customer", "Destination", "Weight (g)", "Amount (Rs)"};
    private static final int[] WIDTHS = {8, 14, 17, 26, 26, 13, 14};
    private static final int LAST_COL = HEADERS.length - 1;

    private ExcelExporter() {}

    /**
     * @param customer  the customer the bill is for, or null when the export covers all customers
     * @param month     "yyyy-MM", or blank / "all"
     * @param invoiceNo the invoice number for this customer and month, or null when there is no single customer
     */
    public static byte[] build(List<PodEntry> entries, Map<Long, String> customerNames,
                               Customer customer, String month, Long invoiceNo) throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("POD Register");

            Font bold = wb.createFont();
            bold.setBold(true);
            Font title = wb.createFont();
            title.setBold(true);
            title.setFontHeightInPoints((short) 16);

            CellStyle titleStyle = wb.createCellStyle();
            titleStyle.setFont(title);
            titleStyle.setAlignment(HorizontalAlignment.CENTER);

            CellStyle centre = wb.createCellStyle();
            centre.setAlignment(HorizontalAlignment.CENTER);

            CellStyle plain = wb.createCellStyle();

            CellStyle head = wb.createCellStyle();
            head.setFont(bold);
            head.setAlignment(HorizontalAlignment.CENTER);
            head.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            head.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            box(head);

            CellStyle cell = wb.createCellStyle();
            box(cell);

            CellStyle cellCentre = wb.createCellStyle();
            cellCentre.setAlignment(HorizontalAlignment.CENTER);
            box(cellCentre);

            CellStyle date = wb.createCellStyle();
            date.setDataFormat(wb.getCreationHelper().createDataFormat().getFormat("dd-mm-yyyy"));
            date.setAlignment(HorizontalAlignment.CENTER);
            box(date);

            CellStyle label = wb.createCellStyle();
            label.setFont(bold);
            box(label);

            CellStyle money = wb.createCellStyle();
            money.setDataFormat(wb.getCreationHelper().createDataFormat().getFormat("0.00"));
            box(money);

            CellStyle grand = wb.createCellStyle();
            grand.setFont(bold);
            box(grand);

            CellStyle words = wb.createCellStyle();
            words.setWrapText(true);
            words.setVerticalAlignment(VerticalAlignment.TOP);
            box(words);

            CellStyle signRight = wb.createCellStyle();
            signRight.setAlignment(HorizontalAlignment.RIGHT);
            box(signRight);

            for (int c = 0; c < WIDTHS.length; c++) {
                sheet.setColumnWidth(c, WIDTHS[c] * 256);
            }

            // ---------- header block, same lines as the printed bill ----------
            LocalDate[] period = periodOf(entries, month);
            int r = 0;
            r = line(sheet, r, 0, LAST_COL, SELLER_NAME, titleStyle);
            r = line(sheet, r, 0, LAST_COL, SELLER_ADDRESS, centre);
            r = line(sheet, r, 0, LAST_COL, "GSTIN:" + SELLER_GSTIN, centre);
            r = pair(sheet, r, "CUSTOMER NAME : " + (customer != null ? customer.getName() : "All customers"),
                    "INVOICE NO:" + (invoiceNo != null ? invoiceNo : ""), plain);
            r = pair(sheet, r, customer != null ? customer.getPlace() : "",
                    "PERIOD FROM:" + dotDate(period[0]) + " to " + dotDate(period[1]), plain);
            r = pair(sheet, r, customer != null && !customer.getGstin().isBlank() ? "GSTIN:" + customer.getGstin() : "",
                    "Billing date: " + dotDate(period[1]), plain);
            r++; // blank spacer row

            // ---------- table ----------
            int headRow = r;
            Row header = sheet.createRow(r++);
            for (int c = 0; c < HEADERS.length; c++) {
                Cell h = header.createCell(c);
                h.setCellValue(HEADERS[c]);
                h.setCellStyle(head);
            }

            int serial = 0;
            long total = 0;
            for (PodEntry e : entries) {
                Row row = sheet.createRow(r++);
                serial++;
                total += e.getAmount();
                put(row, 0, serial, cellCentre);
                Cell d = row.createCell(1);
                d.setCellValue(Date.valueOf(e.getEntryDate()));
                d.setCellStyle(date);
                put(row, 2, e.getPodNumber(), cell); // text, so Excel keeps all 11 digits
                put(row, 3, e.getCustomerId() == null ? "" : customerNames.getOrDefault(e.getCustomerId(), ""), cell);
                put(row, 4, e.getDestination(), cell);
                put(row, 5, e.getWeightGrams(), cell);
                put(row, 6, e.getAmount(), cell);
            }

            // ---------- footer: amount in words, GST, grand total, signature ----------
            if (!entries.isEmpty()) {
                long tax = total * GST_RATE;                // paise
                long gross = total * 100 + 2 * tax;         // paise
                long grandTotal = Math.round(gross / 100.0);
                double roundOff = (grandTotal * 100 - gross) / 100.0;

                int top = r;
                String[] names = {"Total", "CGST " + GST_RATE + "%", "SGST " + GST_RATE + "%", "Round off", "Grand total"};
                double[] values = {total, tax / 100.0, tax / 100.0, roundOff, grandTotal};
                for (int i = 0; i < 5; i++) {
                    Row row = sheet.createRow(top + i);
                    for (int c = 0; c <= 4; c++) row.createCell(c).setCellStyle(words);
                    put(row, 5, names[i], label);
                    Cell v = row.createCell(6);
                    v.setCellValue(values[i]);
                    v.setCellStyle(i == 0 || i == 4 ? grand : money);
                }
                sheet.getRow(top).getCell(0).setCellValue(rupeesInWords(grandTotal));
                sheet.addMergedRegion(new CellRangeAddress(top, top + 4, 0, 4));

                int sign = top + 5;
                Row s1 = sheet.createRow(sign);
                for (int c = 0; c <= LAST_COL; c++) s1.createCell(c).setCellStyle(signRight);
                s1.getCell(0).setCellValue("For " + SIGN_FOR);
                sheet.addMergedRegion(new CellRangeAddress(sign, sign, 0, LAST_COL));
                Row s2 = sheet.createRow(sign + 1);
                s2.setHeightInPoints(36);
                for (int c = 0; c <= LAST_COL; c++) s2.createCell(c).setCellStyle(signRight);
                sheet.addMergedRegion(new CellRangeAddress(sign + 1, sign + 1, 0, LAST_COL));
                Row s3 = sheet.createRow(sign + 2);
                for (int c = 0; c <= LAST_COL; c++) s3.createCell(c).setCellStyle(signRight);
                s3.getCell(0).setCellValue(SIGN_TITLE);
                sheet.addMergedRegion(new CellRangeAddress(sign + 2, sign + 2, 0, LAST_COL));
            }

            // Prints on A4 width with the table heading repeated on every page.
            sheet.createFreezePane(0, headRow + 1);
            sheet.setFitToPage(true);
            PrintSetup ps = sheet.getPrintSetup();
            ps.setFitWidth((short) 1);
            ps.setFitHeight((short) 0);
            sheet.setRepeatingRows(CellRangeAddress.valueOf((headRow + 1) + ":" + (headRow + 1)));

            wb.write(out);
            return out.toByteArray();
        }
    }

    private static void box(CellStyle s) {
        s.setBorderTop(BorderStyle.THIN);
        s.setBorderBottom(BorderStyle.THIN);
        s.setBorderLeft(BorderStyle.THIN);
        s.setBorderRight(BorderStyle.THIN);
    }

    private static void put(Row row, int col, String v, CellStyle st) {
        Cell c = row.createCell(col);
        c.setCellValue(v);
        c.setCellStyle(st);
    }

    private static void put(Row row, int col, double v, CellStyle st) {
        Cell c = row.createCell(col);
        c.setCellValue(v);
        c.setCellStyle(st);
    }

    /** One text line merged across columns c1..c2. Returns the next row index. */
    private static int line(Sheet sheet, int r, int c1, int c2, String text, CellStyle st) {
        Row row = sheet.createRow(r);
        for (int c = c1; c <= c2; c++) row.createCell(c).setCellStyle(st);
        row.getCell(c1).setCellValue(text);
        sheet.addMergedRegion(new CellRangeAddress(r, r, c1, c2));
        return r + 1;
    }

    /** Left text over columns A-D and right text over E-G, like the two halves of the bill header. */
    private static int pair(Sheet sheet, int r, String left, String right, CellStyle st) {
        Row row = sheet.createRow(r);
        for (int c = 0; c <= LAST_COL; c++) row.createCell(c).setCellStyle(st);
        row.getCell(0).setCellValue(left);
        row.getCell(4).setCellValue(right);
        sheet.addMergedRegion(new CellRangeAddress(r, r, 0, 3));
        sheet.addMergedRegion(new CellRangeAddress(r, r, 4, LAST_COL));
        return r + 1;
    }

    /** The month on screen, or from the 1st of the first month to the last day of the last month when "all". */
    static LocalDate[] periodOf(List<PodEntry> entries, String month) {
        if (month != null && !month.isBlank() && !month.equalsIgnoreCase("all")) {
            YearMonth ym = YearMonth.parse(month.trim());
            return new LocalDate[] {ym.atDay(1), ym.atEndOfMonth()};
        }
        if (entries.isEmpty()) return new LocalDate[] {null, null};
        LocalDate min = entries.get(0).getEntryDate(), max = min;
        for (PodEntry e : entries) {
            if (e.getEntryDate().isBefore(min)) min = e.getEntryDate();
            if (e.getEntryDate().isAfter(max)) max = e.getEntryDate();
        }
        return new LocalDate[] {YearMonth.from(min).atDay(1), YearMonth.from(max).atEndOfMonth()};
    }

    /** 2026-04-02 -> 02.04.2026 */
    static String dotDate(LocalDate d) {
        if (d == null) return "";
        return String.format("%02d.%02d.%04d", d.getDayOfMonth(), d.getMonthValue(), d.getYear());
    }

    private static final String[] ONES = {"", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
        "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"};
    private static final String[] TENS = {"", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"};

    private static String below1000(int n) {
        StringBuilder sb = new StringBuilder();
        if (n >= 100) {
            sb.append(ONES[n / 100]).append(" hundred");
            n %= 100;
        }
        if (n >= 20) {
            if (sb.length() > 0) sb.append(' ');
            sb.append(TENS[n / 10]);
            if (n % 10 != 0) sb.append(' ').append(ONES[n % 10]);
        } else if (n > 0) {
            if (sb.length() > 0) sb.append(' ');
            sb.append(ONES[n]);
        }
        return sb.toString();
    }

    /** 2359 -> "Two thousand three hundred fifty nine only."  (Indian grouping: crore, lakh, thousand) */
    static String rupeesInWords(long n) {
        if (n == 0) return "Zero only.";
        StringBuilder sb = new StringBuilder();
        long crore = n / 10_000_000L, lakh = (n / 100_000L) % 100, thou = (n / 1000L) % 100, rest = n % 1000;
        if (crore > 0) sb.append(below1000((int) crore)).append(" crore ");
        if (lakh > 0) sb.append(below1000((int) lakh)).append(" lakh ");
        if (thou > 0) sb.append(below1000((int) thou)).append(" thousand ");
        if (rest > 0) sb.append(below1000((int) rest)).append(' ');
        String s = sb.toString().trim() + " only.";
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
