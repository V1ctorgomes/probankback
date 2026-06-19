import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private auditService: AuditService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.ativo) {
      return null;
    }

    const valid = await argon2.verify(user.senhaHash, password);
    return valid ? user : null;
  }

  async login(user: User, ip?: string): Promise<TokenPair> {
    const tokens = await this.generateTokens(user);
    await this.auditService.log({
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ip,
    });
    return tokens;
  }

  async logout(refreshToken: string, userId: string, ip?: string) {
    await this.prisma.session.deleteMany({ where: { refreshToken } });
    await this.auditService.log({
      userId,
      action: 'LOGOUT',
      entity: 'User',
      entityId: userId,
      ip,
    });
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date() || !session.user.ativo) {
      throw new Error('Sessão inválida');
    }

    await this.prisma.session.delete({ where: { id: session.id } });
    return this.generateTokens(session.user);
  }

  private async generateTokens(user: User): Promise<TokenPair> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      nome: user.nome,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshToken = randomBytes(48).toString('hex');
    const expiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = this.parseExpiry(expiresIn);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private parseExpiry(expiry: string): Date {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + value * multipliers[unit]);
  }

  async seedAdmin() {
    const email = this.config.get('ADMIN_EMAIL', 'admin@probank.local');
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return;
    }

    const password = this.config.get('ADMIN_PASSWORD', 'Admin@123');
    const senhaHash = await argon2.hash(password);

    await this.prisma.user.create({
      data: {
        nome: this.config.get('ADMIN_NAME', 'Administrador'),
        email,
        senhaHash,
        role: UserRole.ADMIN,
      },
    });
  }
}
