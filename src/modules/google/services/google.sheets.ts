import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly spreadSheetId: string;
  private readonly serviceAccountEmail?: string;
  private readonly privateKey?: string;

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get<string>('SHEETS_CLIENT_ID');
    this.clientSecret = this.configService.get<string>('SHEETS_CLIENT_SECRET');
    this.spreadSheetId = this.configService.get<string>('SHEET_ID');
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

  private async getTpColumn(
    paradigm: string,
    tp: string,
    spreadsheetId: string,
    sheetName: string,
  ): Promise<number> {
    try {
      const sheets = await this.getSheetsClient();

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:BA`,
      });
      const columnNanme = `${paradigm}${tp}`;
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
            columnNanme.toLowerCase().trim(),
      );

      if (columnIndex === -1) {
        this.logger.error(`Column with TP "${columnNanme}" not found`);
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
        this.spreadSheetId,
        sheetName,
      );

      // Then get the column for the TP
      const column = await this.getTpColumn(
        paradigm,
        tp,
        this.spreadSheetId,
        sheetName,
      );

      // Get the valid values from the validation rule
      const validationResponse = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadSheetId,
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
        spreadsheetId: this.spreadSheetId,
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
}
