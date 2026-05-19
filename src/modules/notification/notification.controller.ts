import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(FirebaseAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  getNotifications(@CurrentUser() user: any) {
    return this.notificationService.getNotifications(user.sub);
  }

  @Patch(':id/lire')
  marquerCommeLu(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationService.marquerCommeLu(id, user.sub);
  }
}
