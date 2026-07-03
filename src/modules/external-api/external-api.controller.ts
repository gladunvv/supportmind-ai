import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentApiKey } from '../api-keys/decorators/current-api-key.decorator';
import { ApiKeyGuard } from '../api-keys/guards/api-key.guard';
import { ApiKeyContext } from '../api-keys/types/api-key-context.type';
import { ExternalAskDto } from './dto/external-ask.dto';
import { ExternalApiService } from './external-api.service';

@ApiTags('External API')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@Controller('v1')
export class ExternalApiController {
  constructor(private readonly externalApiService: ExternalApiService) {}

  @Post('ask')
  @ApiOkResponse({
    description: 'Ask a question using an API key.',
  })
  ask(@CurrentApiKey() apiKey: ApiKeyContext, @Body() dto: ExternalAskDto) {
    return this.externalApiService.ask(
      apiKey.organizationId,
      apiKey.apiKeyId,
      dto,
    );
  }
}
