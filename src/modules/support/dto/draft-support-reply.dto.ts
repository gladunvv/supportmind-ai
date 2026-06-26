import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SupportTone } from '../../../generated/prisma/enums';

export class DraftSupportReplyDto {
  @ApiProperty({
    example: 'Hi, can I get a refund for my annual plan?',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  customerMessage!: string;

  @ApiPropertyOptional({
    enum: SupportTone,
    example: SupportTone.friendly,
  })
  @IsOptional()
  @IsEnum(SupportTone)
  tone?: SupportTone;
}
