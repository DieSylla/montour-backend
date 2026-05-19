import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseModule } from './firebase/firebase.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { EntrepriseModule } from './modules/entreprise/entreprise.module';
import { TicketModule } from './modules/ticket/ticket.module';
import { ReservationModule } from './modules/reservation/reservation.module';
import { FileAttenteModule } from './modules/file-attente/file-attente.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AdminModule } from './modules/admin/admin.module';
import { CreneauModule } from './modules/creneau/creneau.module';

@Module({
  imports: [
    // Configuration globale (.env)
    ConfigModule.forRoot({ isGlobal: true }),

    // Firebase (disponible partout)
    FirebaseModule,

    // Modules métier
    AuthModule,
    UserModule,
    EntrepriseModule,
    TicketModule,
    ReservationModule,
    FileAttenteModule,
    NotificationModule,
    AdminModule,
    CreneauModule,
  ],
})
export class AppModule {}
