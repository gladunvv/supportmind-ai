import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({
    example: 'Acme Support',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({
    example: 'Customer support workspace for Acme.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}
