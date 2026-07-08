import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { WebhookEventType } from '../../../generated/prisma/enums';

export class CreateWebhookEndpointDto {
  @ApiProperty({
    example: 'Production webhook',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'https://example.com/webhooks/supportmind',
  })
  @IsUrl({
    require_tld: false,
  })
  @MaxLength(2000)
  url!: string;

  @ApiProperty({
    enum: WebhookEventType,
    isArray: true,
    example: [WebhookEventType.document_indexed],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(WebhookEventType, { each: true })
  events!: WebhookEventType[];
}
