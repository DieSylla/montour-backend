import { Module } from '@nestjs/common';
import { FileAttenteController } from './file-attente.controller';
import { FileAttenteService } from './file-attente.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [FileAttenteController],
  providers: [FileAttenteService],
  exports: [FileAttenteService],
})
export class FileAttenteModule {}