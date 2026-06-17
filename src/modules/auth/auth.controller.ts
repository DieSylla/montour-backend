import { Controller, Post, Patch, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('verify-otp')
  verifyOtp(@Body() body: { userId: string; otp: string }) {
    return this.authService.verifyOtp(body.userId, body.otp);
  }

  @Patch('profile')
  @UseGuards(FirebaseAuthGuard)
  updateProfile(
    @CurrentUser() user: any,
    @Body() body: {
      nom?: string;
      prenom?: string;
      telephone?: string;
      specialite?: string;
      confirmationMode?: string;
    }
  ) {
    return this.authService.updateProfile(user.sub, body);
  }

  @Patch('password')
  @UseGuards(FirebaseAuthGuard)
  changePassword(
    @CurrentUser() user: any,
    @Body() body: { ancienMotDePasse: string; nouveauMotDePasse: string }
  ) {
    return this.authService.changePassword(user.sub, body.ancienMotDePasse, body.nouveauMotDePasse);
  }

  @Patch('fcm-token')
  @UseGuards(FirebaseAuthGuard)
  async saveFcmToken(
    @CurrentUser() user: any,
    @Body('token') token: string
  ) {
    return this.authService.saveFcmToken(user.sub, token);
  }
}