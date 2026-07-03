import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({
    example: 'Production integration',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}
