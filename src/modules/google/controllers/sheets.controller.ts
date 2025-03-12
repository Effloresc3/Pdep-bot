import {
  Controller,
  Body,
  HttpCode,
  RawBodyRequest,
  Req,
  Logger,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { Request } from 'express';

import { GoogleSheetsService } from '@app/modules/google/services/google.sheets';

@Controller('sheets')
export class SheetsController {
  private readonly logger = new Logger(SheetsController.name);

  constructor(private sheetsService: GoogleSheetsService) {}

  @Get(':id')
  @HttpCode(200)
  async obtainNames(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: any,
    @Param('id') id: string,
  ) {
    return this.sheetsService.getSheetNames(id);
  }

  @Get(':id/sheet')
  @HttpCode(200)
  async obtainSpreadsheet(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: any,
    @Param('id') id: string,
    @Query('name') name: string,
  ) {
    return this.sheetsService.getSheetId(id, name);
  }
}