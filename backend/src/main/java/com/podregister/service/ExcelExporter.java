package com.podregister.service;

import com.podregister.model.PodEntry;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.sql.Date;
import java.util.List;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.PrintSetup;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

public final class ExcelExporter {

    private static final String[] HEADERS = {"S.No", "Date", "POD Number", "Destination", "Weight (g)", "Amount (Rs)"};
    private static final int[] WIDTHS = {8, 14, 17, 26, 13, 14};

    private ExcelExporter() {}

    public static byte[] build(List<PodEntry> entries) throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("POD Register");

            Font bold = wb.createFont();
            bold.setBold(true);

            CellStyle head = wb.createCellStyle();
            head.setFont(bold);
            head.setBorderBottom(BorderStyle.THIN);
            head.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            head.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            CellStyle date = wb.createCellStyle();
            date.setDataFormat(wb.getCreationHelper().createDataFormat().getFormat("dd-mm-yyyy"));

            CellStyle total = wb.createCellStyle();
            total.setFont(bold);
            total.setBorderTop(BorderStyle.THIN);

            Row header = sheet.createRow(0);
            for (int c = 0; c < HEADERS.length; c++) {
                Cell cell = header.createCell(c);
                cell.setCellValue(HEADERS[c]);
                cell.setCellStyle(head);
                sheet.setColumnWidth(c, WIDTHS[c] * 256);
            }

            int r = 1;
            for (PodEntry e : entries) {
                Row row = sheet.createRow(r);
                row.createCell(0).setCellValue(r);
                Cell d = row.createCell(1);
                d.setCellValue(Date.valueOf(e.getEntryDate()));
                d.setCellStyle(date);
                row.createCell(2).setCellValue(e.getPodNumber()); // text, so Excel keeps all 11 digits
                row.createCell(3).setCellValue(e.getDestination());
                row.createCell(4).setCellValue(e.getWeightGrams());
                row.createCell(5).setCellValue(e.getAmount());
                r++;
            }

            if (!entries.isEmpty()) {
                Row row = sheet.createRow(r);
                Cell label = row.createCell(3);
                label.setCellValue("Total");
                label.setCellStyle(total);
                Cell w = row.createCell(4);
                w.setCellFormula("SUM(E2:E" + r + ")");
                w.setCellStyle(total);
                Cell a = row.createCell(5);
                a.setCellFormula("SUM(F2:F" + r + ")");
                a.setCellStyle(total);
            }

            // Prints on A4 width with the header repeated on every page.
            sheet.createFreezePane(0, 1);
            sheet.setFitToPage(true);
            PrintSetup ps = sheet.getPrintSetup();
            ps.setFitWidth((short) 1);
            ps.setFitHeight((short) 0);
            sheet.setRepeatingRows(CellRangeAddress.valueOf("1:1"));

            wb.write(out);
            return out.toByteArray();
        }
    }
}
