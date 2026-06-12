import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'owner@supportmind.dev',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'StrongPassword123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    example: 'Vlad',
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    example: 'Gladun',
  })
  @IsOptional()
  @IsString()
  lastName?: string;
}
