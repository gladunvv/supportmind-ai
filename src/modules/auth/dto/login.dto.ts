import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'owner@supportmind.dev',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'StrongPassword123!',
  })
  @IsString()
  @MinLength(8)
  password!: string;
}
