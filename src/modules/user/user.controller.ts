import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  getProfile(@CurrentUser() user: any) {
    return this.userService.getProfile(user.uid);
  }

  @Patch('me/fcm-token')
  updateFcmToken(@CurrentUser() user: any, @Body('fcmToken') token: string) {
    return this.userService.updateFcmToken(user.uid, token);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: any, @Body() data: any) {
    return this.userService.updateProfile(user.uid, data);
  }
}
