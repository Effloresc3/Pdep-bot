import { Module } from '@nestjs/common';

import { GoogleSheetsService } from '@app/modules/google/services/google.sheets';

@Module({
  providers: [GoogleSheetsService],
  exports: [GoogleSheetsService],
})
export class GoogleModule {}
