import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { AbsenceScheduler } from './absence.scheduler';
import { FileAttenteModule } from '../file-attente/file-attente.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    FileAttenteModule,
    NotificationModule,
    JwtModule.register({}),
  ],
  controllers: [TicketController],
  providers: [TicketService, AbsenceScheduler],
  exports: [TicketService],
})
export class TicketModule {}