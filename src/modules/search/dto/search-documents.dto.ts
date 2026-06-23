import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SearchDocumentsDto {
  @ApiProperty({
    example: 'How do refunds work?',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  query!: string;
}
