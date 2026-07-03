import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import type { ApiResponse, AuthResponseDto, SignInDto, SignUpDto } from '@dmtecha/shared-types';

import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signUp(@Body() body: SignUpDto): Promise<ApiResponse<AuthResponseDto>> {
    const result = await this.authService.signUp(body.email, body.password, body.fullName);
    return { success: true, data: result };
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() body: SignInDto): Promise<ApiResponse<AuthResponseDto>> {
    const result = await this.authService.signIn(body.email, body.password);
    return { success: true, data: result };
  }

  @Post('signout')
  @HttpCode(HttpStatus.OK)
  async signOut(@Body() body: { accessToken: string }): Promise<ApiResponse<null>> {
    await this.authService.signOut(body.accessToken);
    return { success: true, data: null };
  }
}
