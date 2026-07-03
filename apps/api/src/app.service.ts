import { Injectable } from '@nestjs/common';

import type { ApiResponse } from '@dmtecha/shared-types';
import { nowISO } from '@dmtecha/utils';

@Injectable()
export class AppService {
  getHealth(): ApiResponse<{ status: string; timestamp: string }> {
    return {
      success: true,
      data: {
        status: 'ok',
        timestamp: nowISO(),
      },
    };
  }
}
