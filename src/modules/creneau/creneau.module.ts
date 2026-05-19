import { Module } from '@nestjs/common';
import { CreneauController } from './creneau.controller';
import { CreneauService } from './creneau.service';
import { FirebaseModule } from '../../firebase/firebase.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    FirebaseModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
    }),
  ],
  controllers: [CreneauController],
  providers: [CreneauService],
  exports: [CreneauService],
})
export class CreneauModule {}