import { Module } from '@nestjs/common';

import { HttpService } from '@app/common/services/http.service';

@Module({
  providers: [HttpService],
  exports: [HttpService],
})
export class HttpModule {}
