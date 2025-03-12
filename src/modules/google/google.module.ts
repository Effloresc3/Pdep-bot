import { Module } from '@nestjs/common';

import { GoogleSheetsService } from '@app/modules/google/services/google.sheets';
import { SheetsController } from '@app/modules/google/controllers/sheets.controller';

@Module({
  controllers: [SheetsController],
  providers: [GoogleSheetsService],
})
export class GoogleModule {}
