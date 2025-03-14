import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);

  // Define scopes for Google Sheets API access
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/spreadsheets', // For write access
  ];

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;
  private readonly redirectUri: string;
  private readonly spreadSheetId: string;

  constructor(private configService: ConfigService) {
    // Load credentials from environment variables
    this.clientId = this.configService.get<string>('SHEETS_CLIENT_ID');
    this.clientSecret = this.configService.get<string>('SHEETS_CLIENT_SECRET');
    this.refreshToken = this.configService.get<string>('GOOGLE_REFRESH_TOKEN');
    this.redirectUri = this.configService.get<string>(
      'GOOGLE_REDIRECT_URI',
      'http://localhost',
    );
    this.spreadSheetId = this.configService.get<string>('SHEET_ID');
    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'Google API credentials not found in environment variables',
      );
    }
  }

  /**
   * Authorizes with Google API using OAuth2
   */
  authorize(): OAuth2Client {
    try {
      // Create OAuth client using environment variables
      const oauth2Client = new OAuth2Client({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        redirectUri: this.redirectUri,
      });

      // Set credentials using the refresh token
      if (this.refreshToken) {
        oauth2Client.setCredentials({ refresh_token: this.refreshToken });
        this.logger.debug('Using refresh token from environment variables');
        return oauth2Client;
      }

      // If no refresh token is available, throw an error
      this.logger.error(
        'No refresh token available. Authentication cannot proceed.',
      );
      throw new Error(
        'Missing Google API refresh token. Please set GOOGLE_REFRESH_TOKEN environment variable.',
      );
    } catch (error) {
      this.logger.error(`Authorization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Creates a sheets client with proper authentication
   */
  private getSheetsClient(): sheets_v4.Sheets {
    const auth = this.authorize();
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
      const sheets = this.getSheetsClient();

      // First, get the sheet data
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:BA`, // Adjust range as needed
      });

      const values = response.data.values;
      if (!values) {
        throw new Error('No data found in the sheet');
      }

      // Find the column index that matches our column name
      const headerRow = values[0];
      const columnIndex = headerRow.findIndex(
        (header) => header?.toLowerCase() === column.toLowerCase(),
      );

      if (columnIndex === -1) {
        throw new Error(`Column "${column}" not found`);
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
      this.logger.error(`Failed to get group rows: ${error.message}`);
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

      // Get the sheet data
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:BA`, // Adjust range as needed
      });
      const columnNanme = `${paradigm}${tp}`;
      const values = response.data.values;
      if (!values) {
        throw new Error('No data found in the sheet');
      }

      // Find the column index that matches the TP name
      const headerRow = values[0];
      headerRow.forEach((header, index) => {
        const processedValue = header
          ?.toLowerCase()
          .replace(/\r?\n/g, '')
          .trim();
        this.logger.log(`Column ${index + 1}: ${processedValue}`);
      });
      const columnIndex = headerRow.findIndex(
        (header) =>
          header?.toLowerCase().replace(/\r?\n/g, '').trim() ===
          columnNanme.toLowerCase().trim(),
      );

      if (columnIndex === -1) {
        throw new Error(`Column with TP "${columnNanme}" not found`);
      }

      // Return 1-based column index (as Google Sheets uses 1-based indices)
      return columnIndex + 1;
    } catch (error) {
      this.logger.error(`Failed to get TP column: ${error.message}`);
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
        throw new Error('No dropdown validation found for the status cell');
      }

      const validValues = validation.condition.values.map(
        (v) => v.userEnteredValue,
      );

      if (!validValues.includes(newStatus)) {
        throw new Error(
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
      this.logger.error(`Failed to update TP status: ${error.message}`);
      throw error;
    }
  }

  private columnToLetter(column: number): string {
    let letter = '';
    let temp = column;

    while (temp > 0) {
      temp--;
      letter = String.fromCharCode(65 + (temp % 26)) + letter;
      temp = Math.floor(temp / 26);
    }

    return letter;
  }
}
