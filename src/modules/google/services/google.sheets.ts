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

  constructor(private configService: ConfigService) {
    // Load credentials from environment variables
    this.clientId = this.configService.get<string>('SHEETS_CLIENT_ID');
    this.clientSecret = this.configService.get<string>('SHEETS_CLIENT_SECRET');
    this.refreshToken = this.configService.get<string>('GOOGLE_REFRESH_TOKEN');
    this.redirectUri = this.configService.get<string>(
      'GOOGLE_REDIRECT_URI',
      'http://localhost',
    );

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        'Google API credentials not found in environment variables',
      );
    }
  }

  /**
   * Authorizes with Google API using OAuth2
   */
  async authorize(): Promise<OAuth2Client> {
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
  private async getSheetsClient(): Promise<sheets_v4.Sheets> {
    const auth = await this.authorize();
    return google.sheets({ version: 'v4', auth } as sheets_v4.Options);
  }

  /**
   * Creates a new Google Sheet
   * @param title The title for the new spreadsheet
   * @returns The ID of the created spreadsheet
   */
  async createSpreadsheet(title: string): Promise<string> {
    try {
      const sheets = await this.getSheetsClient();

      const response = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title },
          sheets: [
            {
              properties: {
                title: 'Sheet1',
                gridProperties: {
                  rowCount: 100,
                  columnCount: 20,
                },
              },
            },
          ],
        },
      });

      this.logger.log(
        `Created spreadsheet with ID: ${response.data.spreadsheetId}`,
      );
      return response.data.spreadsheetId;
    } catch (error) {
      this.logger.error(`Failed to create spreadsheet: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets information about a spreadsheet
   * @param spreadsheetId The ID of the spreadsheet
   */
  async getSpreadsheetInfo(
    spreadsheetId: string,
  ): Promise<sheets_v4.Schema$Spreadsheet> {
    try {
      const sheets = await this.getSheetsClient();

      const response = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get spreadsheet info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets data from a spreadsheet
   * @param spreadsheetId The ID of the spreadsheet
   * @param range The A1 notation of the range to fetch
   * @returns Array of rows (which are arrays of cell values)
   */
  async getValues(spreadsheetId: string, range: string): Promise<any[][]> {
    try {
      const sheets = await this.getSheetsClient();

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      return response.data.values || [];
    } catch (error) {
      this.logger.error(`Failed to get values: ${error.message}`);
      throw error;
    }
  }

  /**
   * Updates values in a spreadsheet
   * @param spreadsheetId The ID of the spreadsheet
   * @param range The A1 notation of the range to update
   * @param values The data to write
   * @returns Number of cells updated
   */
  async updateValues(
    spreadsheetId: string,
    range: string,
    values: any[][],
  ): Promise<number> {
    try {
      const sheets = await this.getSheetsClient();

      const response = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values,
        },
      });

      this.logger.log(`Updated ${response.data.updatedCells} cells`);
      return response.data.updatedCells;
    } catch (error) {
      this.logger.error(`Failed to update values: ${error.message}`);
      throw error;
    }
  }

  /**
   * Appends values to a spreadsheet
   * @param spreadsheetId The ID of the spreadsheet
   * @param range The A1 notation of the range where data should be appended
   * @param values The data to append
   * @returns Information about the append operation
   */
  async appendValues(
    spreadsheetId: string,
    range: string,
    values: any[][],
  ): Promise<sheets_v4.Schema$AppendValuesResponse> {
    try {
      const sheets = await this.getSheetsClient();

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values,
        },
      });

      this.logger.log(`Appended data to range: ${response.data.tableRange}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to append values: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clears values from a spreadsheet
   * @param spreadsheetId The ID of the spreadsheet
   * @param range The A1 notation of the range to clear
   */
  async clearValues(
    spreadsheetId: string,
    range: string,
  ): Promise<sheets_v4.Schema$ClearValuesResponse> {
    try {
      const sheets = await this.getSheetsClient();

      const response = await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range,
      });

      this.logger.log(`Cleared range: ${response.data.clearedRange}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to clear values: ${error.message}`);
      throw error;
    }
  }

  /**
   * Adds a new sheet to an existing spreadsheet
   * @param spreadsheetId The ID of the spreadsheet
   * @param sheetTitle The title for the new sheet
   */
  // Fix #2: Corrected the return type to sheets_v4.Schema$SheetProperties
  async addSheet(
    spreadsheetId: string,
    sheetTitle: string,
  ): Promise<sheets_v4.Schema$SheetProperties> {
    try {
      const sheets = await this.getSheetsClient();

      const response = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetTitle,
                },
              },
            },
          ],
        },
      });

      this.logger.log(`Added sheet: ${sheetTitle}`);
      return response.data.replies[0].addSheet.properties;
    } catch (error) {
      this.logger.error(`Failed to add sheet: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deletes a sheet from a spreadsheet
   * @param spreadsheetId The ID of the spreadsheet
   * @param sheetId The ID of the sheet to delete
   */
  async deleteSheet(spreadsheetId: string, sheetId: number): Promise<void> {
    try {
      const sheets = await this.getSheetsClient();

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteSheet: {
                sheetId,
              },
            },
          ],
        },
      });

      this.logger.log(`Deleted sheet with ID: ${sheetId}`);
    } catch (error) {
      this.logger.error(`Failed to delete sheet: ${error.message}`);
      throw error;
    }
  }

  /**
   * Formats cells in a spreadsheet
   * @param spreadsheetId The ID of the spreadsheet
   * @param sheetId The ID of the sheet
   * @param range The range in A1 notation
   * @param format The formatting to apply
   */
  async formatCells(
    spreadsheetId: string,
    sheetId: number,
    startRowIndex: number,
    endRowIndex: number,
    startColumnIndex: number,
    endColumnIndex: number,
    format: Partial<sheets_v4.Schema$CellFormat>,
  ): Promise<void> {
    try {
      const sheets = await this.getSheetsClient();

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex,
                  endRowIndex,
                  startColumnIndex,
                  endColumnIndex,
                },
                cell: {
                  userEnteredFormat: format,
                },
                fields: 'userEnteredFormat',
              },
            },
          ],
        },
      });

      this.logger.log(`Formatted cells in sheet ${sheetId}`);
    } catch (error) {
      this.logger.error(`Failed to format cells: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resizes a column in a spreadsheet
   * @param spreadsheetId The ID of the spreadsheet
   * @param sheetId The ID of the sheet
   * @param columnIndex The index of the column to resize
   * @param pixelSize The new pixel size
   */
  async resizeColumn(
    spreadsheetId: string,
    sheetId: number,
    columnIndex: number,
    pixelSize: number,
  ): Promise<void> {
    try {
      const sheets = await this.getSheetsClient();

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              updateDimensionProperties: {
                range: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: columnIndex,
                  endIndex: columnIndex + 1,
                },
                properties: {
                  pixelSize,
                },
                fields: 'pixelSize',
              },
            },
          ],
        },
      });

      this.logger.log(`Resized column ${columnIndex} to ${pixelSize}px`);
    } catch (error) {
      this.logger.error(`Failed to resize column: ${error.message}`);
      throw error;
    }
  }

  /**
   * Example method to read student data from a specific spreadsheet
   * This is just a sample method that could be customized for specific use cases
   */
  async getStudentData(): Promise<{ name: string; major: string }[]> {
    try {
      const rows = await this.getValues(
        '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        'Class Data!A2:E',
      );

      if (rows.length === 0) {
        return [];
      }

      return rows.map((row) => ({
        name: row[0],
        major: row[4],
      }));
    } catch (error) {
      this.logger.error(`Failed to get student data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generic method to transform sheets data to typed objects
   * @param spreadsheetId The ID of the spreadsheet
   * @param range The A1 notation of the range
   * @param transform Function to transform rows to typed objects
   */
  async getTypedData<T>(
    spreadsheetId: string,
    range: string,
    transform: (rows: any[][]) => T[],
  ): Promise<T[]> {
    const rows = await this.getValues(spreadsheetId, range);
    return transform(rows);
  }

  /**
   * Converts an array of objects to a 2D array for sheet data
   * First row contains headers based on object keys
   * @param objects Array of objects to convert to rows
   */
  objectsToSheetValues<T>(objects: T[]): any[][] {
    if (!objects.length) return [];

    // Get keys from the first object to create headers
    const keys = Object.keys(objects[0]);

    // Create header row
    const headerRow = keys;

    // Create data rows
    const dataRows = objects.map((obj) => keys.map((key) => obj[key]));

    return [headerRow, ...dataRows];
  }

  /**
   * Checks if a spreadsheet exists and is accessible
   * @param spreadsheetId The ID of the spreadsheet to check
   */
  async spreadsheetExists(spreadsheetId: string): Promise<boolean> {
    try {
      await this.getSpreadsheetInfo(spreadsheetId);
      return true;
    } catch (error) {
      if (error.code === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Gets all sheet names in a spreadsheet
   * @param spreadsheetId The ID of the spreadsheet
   */
  async getSheetNames(spreadsheetId: string): Promise<string[]> {
    try {
      const info = await this.getSpreadsheetInfo(spreadsheetId);
      return info.sheets.map((sheet) => sheet.properties.title);
    } catch (error) {
      this.logger.error(`Failed to get sheet names: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets a sheet ID by name
   * @param spreadsheetId The ID of the spreadsheet
   * @param sheetName The name of the sheet
   */
  async getSheetId(spreadsheetId: string, sheetName: string): Promise<number> {
    try {
      const info = await this.getSpreadsheetInfo(spreadsheetId);
      const sheet = info.sheets.find((s) => s.properties.title === sheetName);

      if (!sheet) {
        throw new Error(`Sheet "${sheetName}" not found`);
      }

      return sheet.properties.sheetId;
    } catch (error) {
      this.logger.error(`Failed to get sheet ID: ${error.message}`);
      throw error;
    }
  }
}
