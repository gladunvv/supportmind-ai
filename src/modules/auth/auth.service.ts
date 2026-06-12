import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types/jwt-payload.type';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import type { StringValue } from 'ms';

type AuthResponse = {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
    });

    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
    });

    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      ...tokens,
    };
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResponse> {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(
        dto.refreshToken,
        {
          secret: process.env.JWT_REFRESH_SECRET,
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isRefreshTokenValid = await argon2.verify(
      user.refreshTokenHash,
      dto.refreshToken,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
    });

    await this.updateRefreshTokenHash(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      ...tokens,
    };
  }

  async logout(userId: string): Promise<{ success: true }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash: null,
      },
    });

    return { success: true };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    return user;
  }

  private async generateTokens(payload: JwtPayload): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET is not defined');
    }

    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }

    const accessTokenExpiresIn = (process.env.JWT_ACCESS_EXPIRES_IN ??
      '15m') as StringValue;

    const refreshTokenExpiresIn = (process.env.JWT_REFRESH_EXPIRES_IN ??
      '7d') as StringValue;

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: accessSecret,
      expiresIn: accessTokenExpiresIn,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: refreshTokenExpiresIn,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async updateRefreshTokenHash(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const refreshTokenHash = await argon2.hash(refreshToken);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokenHash,
      },
    });
  }
}
