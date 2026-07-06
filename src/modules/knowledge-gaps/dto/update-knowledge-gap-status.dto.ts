import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { KnowledgeGapStatus } from '../../../generated/prisma/enums';

export class UpdateKnowledgeGapStatusDto {
  @ApiProperty({
    enum: KnowledgeGapStatus,
    example: KnowledgeGapStatus.resolved,
  })
  @IsEnum(KnowledgeGapStatus)
  status!: KnowledgeGapStatus;
}
