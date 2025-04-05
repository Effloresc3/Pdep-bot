import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly spreadsheetId: string;
  private readonly serviceAccountEmail?: string;
  private readonly privateKey?: string;

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get<string>('SHEETS_CLIENT_ID');
    this.clientSecret = this.configService.get<string>('SHEETS_CLIENT_SECRET');
    this.spreadsheetId = this.configService.get<string>('SHEET_ID');
    this.serviceAccountEmail = this.configService.get<string>(
      'SERVICE_ACCOUNT_EMAIL',
    );
    this.privateKey = this.configService
      .get<string>('SERVICE_ACCOUNT_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'Google API credentials not found in environment variables',
      );
    }
  }

  async authorize(): Promise<OAuth2Client> {
    try {
      if (!this.serviceAccountEmail || !this.privateKey) {
        throw new Error('Service account credentials are not configured');
      }
      const jwtClient = new google.auth.JWT(
        this.serviceAccountEmail,
        null,
        this.privateKey,
        ['https://www.googleapis.com/auth/spreadsheets'],
        null,
      );

      await jwtClient.authorize();
      this.logger.debug('Successfully authenticated using service account');

      return jwtClient;
    } catch (error) {
      this.logger.error(`Authorization failed: ${error}`);
      throw error;
    }
  }

  private async getSheetsClient(): Promise<sheets_v4.Sheets> {
    const auth = await this.authorize();
    return google.sheets({ version: 'v4', auth } as sheets_v4.Options);
  }

  private async getGroupRows(
    paradigm: string,
    groupName: string,
    spreadsheetId: string,
    sheetName: string,
  ): Promise<number[]> {
    try {
      const column = `Grupo de ${paradigm}`;
      const sheets = await this.getSheetsClient();

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:BA`,
      });

      const values = response.data.values;
      if (!values) {
        this.logger.error('No data found in the sheet');
      }

      // Find the column index that matches our column name
      const headerRow = values[0];
      const columnIndex = headerRow.findIndex(
        (header) =>
          typeof header === 'string' &&
          header.toLowerCase() === column.toLowerCase(),
      );

      if (columnIndex === -1) {
        this.logger.error(`Column "${column}" not found`);
      }

      // Find all rows that contain the group name in the correct column
      const matchingRows: number[] = [];

      values.forEach((row, index) => {
        if (index === 0) return; // Skip header row
        if (row[columnIndex] === groupName) {
          // Add 1 to convert to 1-based index used by Google Sheets
          matchingRows.push(index + 1);
        }
      });

      if (matchingRows.length === 0) {
        throw new Error(`Group "${groupName}" not found in column "${column}"`);
      }

      return matchingRows;
    } catch (error) {
      this.logger.error(`Failed to get group rows: ${error}`);
      throw error;
    }
  }

  private async getByColumnName(
    columnName: string,
    spreadsheetId: string,
    sheetName: string,
  ): Promise<number> {
    try {
      const sheets = await this.getSheetsClient();

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:BA`,
      });
      const values = response.data.values;
      if (!values) {
        this.logger.error('No data found in the sheet');
      }

      // Find the column index that matches the TP name
      const headerRow = values[0];

      const columnIndex = headerRow.findIndex(
        (header) =>
          typeof header === 'string' &&
          header?.toLowerCase().replace(/\r?\n/g, '').trim() ===
            columnName.toLowerCase().trim(),
      );

      if (columnIndex === -1) {
        this.logger.error(`Column with name "${columnName}" not found`);
      }

      // Return 1-based column index (as Google Sheets uses 1-based indices)
      return columnIndex + 1;
    } catch (error) {
      this.logger.error(`Failed to get TP column: ${error}`);
      throw error;
    }
  }

  async updateTpStatus(
    sheetName: string,
    paradigm: string,
    groupName: string,
    tp: string,
    newStatus: string,
  ): Promise<void> {
    try {
      const sheets = await this.getSheetsClient();

      // First, get the rows for the group
      const rows = await this.getGroupRows(
        paradigm,
        groupName,
        this.spreadsheetId,
        sheetName,
      );
      const columnName = `${paradigm}${tp}`;
      // Then get the column for the TP
      const column = await this.getByColumnName(
        columnName,
        this.spreadsheetId,
        sheetName,
      );

      // Get the valid values from the validation rule
      const validationResponse = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        includeGridData: true,
        ranges: [`${sheetName}!${this.columnToLetter(column)}2`],
      });

      const sheet = validationResponse.data.sheets?.[0];
      const validation =
        sheet?.data?.[0]?.rowData?.[0]?.values?.[0]?.dataValidation;

      if (!validation?.condition?.values) {
        this.logger.error('No dropdown validation found for the status cell');
      }

      const validValues = validation.condition.values.map(
        (value) => value.userEnteredValue,
      );

      if (!validValues.includes(newStatus)) {
        this.logger.error(
          `Invalid status: ${newStatus}. Must be one of: ${validValues.join(', ')}`,
        );
      }

      // Update all cells
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: rows.map((row) => ({
            range: `${sheetName}!${this.columnToLetter(column)}${row}`,
            values: [[newStatus]],
          })),
        },
      });

      this.logger.log(
        `Successfully updated status to ${newStatus} for group ${groupName} in ${tp}`,
      );
    } catch (error) {
      this.logger.error(`Failed to update TP status: ${error}`);
      throw error;
    }
  }

  private columnToLetter(column: number): string {
    if (column <= 0) {
      return '';
    }

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    let remaining = column;

    while (remaining > 0) {
      remaining--;
      const currentChar = alphabet[remaining % 26];
      result = currentChar + result;
      remaining = Math.floor(remaining / 26);
    }

    return result;
  }

  async registerUser(
    legajo: string,
    name: string,
    email: string,
    github: string,
    spreadsheetId: string,
    sheetName: string,
  ) {
    try {
      const sheets = await this.getSheetsClient();

      // Get the column indices for each field
      const columnIndices = await this.getColumnIndices(
        ['Legajo', 'Nombre', 'Email', 'Usuario de GitHub', 'Curso'],
        spreadsheetId,
        sheetName,
      );

      const legajoColumn = columnIndices['Legajo'];
      const nameColumn = columnIndices['Nombre'];
      const emailColumn = columnIndices['Email'];
      const githubColumn = columnIndices['Usuario de GitHub'];
      const cursoColumn = columnIndices['Curso']; // Add this to find the curso column

      // Get all the data
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: `${sheetName}!A1:BA`,
      });

      const values = response.data.values || [];
      if (!values.length) {
        throw new Error('No data found in the sheet');
      }

      // Find the row where "Curso" appears
      let cursoRowIndex = -1;
      for (let i = 0; i < values.length; i++) {
        if (
          values[i][cursoColumn - 1] === 'Curso' ||
          values[i].some((cell) => cell && cell.toLowerCase() === 'curso')
        ) {
          cursoRowIndex = i;
          break;
        }
      }

      if (cursoRowIndex === -1) {
        throw new Error('Could not find a row with "Curso" in it');
      }

      // The row to insert will be directly after the curso row
      const nextRowIndex = cursoRowIndex + 1; // 0-indexed
      const targetRow = nextRowIndex + 1; // 1-indexed for sheets API

      // Get the "Curso" value from the next row
      let cursoValue = '';
      if (
        nextRowIndex < values.length &&
        values[nextRowIndex].length > cursoColumn - 1
      ) {
        cursoValue = values[nextRowIndex][cursoColumn - 1] || '';
      }

      // Get spreadsheet metadata to check the current grid size
      const metadata = await sheets.spreadsheets.get({
        spreadsheetId,
        includeGridData: false,
      });

      const sheet = metadata.data.sheets.find(
        (s) => s.properties.title === sheetName,
      );
      if (!sheet) {
        throw new Error(`Sheet '${sheetName}' not found`);
      }

      // Insert a new row above the next row (which is the same as inserting after the curso row)
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId: sheet.properties.sheetId,
                  dimension: 'ROWS',
                  startIndex: nextRowIndex, // 0-indexed in the API
                  endIndex: nextRowIndex + 1, // exclusive end index
                },
                inheritFromBefore: false, // Do NOT inherit formatting from row above (curso row)
              },
            },
          ],
        },
      });

      // Copy formatting from the next row (which is now nextRowIndex + 1 after insertion)
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              copyPaste: {
                source: {
                  sheetId: sheet.properties.sheetId,
                  startRowIndex: nextRowIndex + 1, // The row after our newly inserted row
                  endRowIndex: nextRowIndex + 2,
                  startColumnIndex: 0,
                  endColumnIndex: 100, // Assuming your sheet doesn't have more than 100 columns
                },
                destination: {
                  sheetId: sheet.properties.sheetId,
                  startRowIndex: nextRowIndex,
                  endRowIndex: nextRowIndex + 1,
                  startColumnIndex: 0,
                  endColumnIndex: 100,
                },
                pasteType: 'PASTE_FORMAT',
                pasteOrientation: 'NORMAL',
              },
            },
          ],
        },
      });

      // Prepare data updates for each column
      const data = [
        {
          range: `${sheetName}!${this.columnToLetter(legajoColumn)}${targetRow}`,
          values: [[legajo]],
        },
        {
          range: `${sheetName}!${this.columnToLetter(nameColumn)}${targetRow}`,
          values: [[name]],
        },
        {
          range: `${sheetName}!${this.columnToLetter(emailColumn)}${targetRow}`,
          values: [[email]],
        },
        {
          range: `${sheetName}!${this.columnToLetter(githubColumn)}${targetRow}`,
          values: [[github]],
        },
        {
          range: `${sheetName}!${this.columnToLetter(cursoColumn)}${targetRow}`,
          values: [[cursoValue]],
        },
      ];

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data,
        },
      });

      this.logger.debug(`User registered in row ${targetRow}`);
      return targetRow;
    } catch (error) {
      this.logger.error(`Failed to register user: ${error}`);
      throw error;
    }
  }

  private async getColumnIndices(
    columnNames: string[],
    spreadsheetId: string,
    sheetName: string,
  ): Promise<Record<string, number>> {
    try {
      const sheets = await this.getSheetsClient();

      // Get only the header row
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!1:1`,
      });

      const headerRow = response.data.values?.[0] || [];
      if (!headerRow.length) {
        throw new Error('No headers found in the sheet');
      }

      // Create a map of column names to indices
      const result: Record<string, number> = {};

      for (const columnName of columnNames) {
        const index = headerRow.findIndex(
          (header) =>
            typeof header === 'string' &&
            header.toLowerCase() === columnName.toLowerCase(),
        );

        if (index === -1) {
          throw new Error(`Column "${columnName}" not found in sheet headers`);
        }

        // Add 1 to convert from 0-based to 1-based index
        result[columnName] = index + 1;
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to get column indices: ${error}`);
      throw error;
    }
  }
}
