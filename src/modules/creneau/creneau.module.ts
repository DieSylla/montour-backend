import { Module } from '@nestjs/common';
import { CreneauController } from './creneau.controller';
import { CreneauService } from './creneau.service';
import { FirebaseModule } from '../../firebase/firebase.module';
import { JwtModule } from '@nestjs/jwt';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    FirebaseModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
    }),
    NotificationModule,
  ],
  controllers: [CreneauController],
  providers: [CreneauService],
  exports: [CreneauService],
})
export class CreneauModule {}