import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AskAiDto {
  @ApiProperty({
    example: 'How do annual refunds work?',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  question!: string;
}
