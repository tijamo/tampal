import ExcelJS from 'exceljs';
import type { RawImportRow } from './chmeetings';

/**
 * Reads the first worksheet of an uploaded .xlsx file into header-keyed row
 * objects. Runs server-side (Server Action) so we don't ship a spreadsheet
 * parser to the client bundle.
 */
export async function parseWorkbookRows(buffer: ArrayBuffer): Promise<RawImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '').trim();
  });

  const rows: RawImportRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (row.cellCount === 0) continue;

    const obj: RawImportRow = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      const value = cell.value;
      if (value !== null && value !== undefined && value !== '') hasValue = true;
      obj[header] = value instanceof Date ? value : (value as string | number | null);
    });
    if (hasValue) rows.push(obj);
  }

  return rows;
}
