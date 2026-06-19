import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { loginSchema, refreshSchema } from './dto/auth.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  ClientIp,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() body: { email: string; password: string }, @ClientIp() ip: string) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.authService.login(user, ip);
  }

  @Post('refresh')
  @UsePipes(new ZodValidationPipe(refreshSchema))
  async refresh(@Body() body: { refreshToken: string }) {
    try {
      return await this.authService.refreshTokens(body.refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Body() body: { refreshToken?: string },
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string,
  ) {
    if (body.refreshToken) {
      await this.authService.logout(body.refreshToken, user.id, ip);
    }
    return { message: 'Logout realizado' };
  }
}
