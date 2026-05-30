import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FirebaseService } from '../../firebase/firebase.service';
import { FileAttenteService } from '../file-attente/file-attente.service';
import { NotificationService } from '../notification/notification.service';

const DELAI_ABSENCE_MINUTES = 3;

@Injectable()
export class AbsenceScheduler {
  private readonly logger = new Logger(AbsenceScheduler.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly fileAttenteService: FileAttenteService,
    private readonly notificationService: NotificationService,
  ) {}

  // Vérifie toutes les minutes les clients appelés
  @Cron(CronExpression.EVERY_MINUTE)
  async verifierClientsAbsents() {
    try {
      const maintenant = new Date();

      // Récupérer tous les tickets APPELÉ
      const snapshot = await this.firebase.collection('tickets')
        .where('statut', '==', 'APPELE')
        .get();

      if (snapshot.empty) return;

      for (const doc of snapshot.docs) {
        const ticket = doc.data();

        // Calculer depuis combien de temps le ticket est APPELÉ
        const appeleLe = ticket.updatedAt?.toDate?.() || ticket.createdAt?.toDate?.();
        if (!appeleLe) continue;

        const minutesEcoulees = (maintenant.getTime() - appeleLe.getTime()) / 60000;

        if (minutesEcoulees >= DELAI_ABSENCE_MINUTES) {
          this.logger.log(`Client absent détecté : ticket ${ticket.id}`);

          // Marquer absent et appeler le suivant automatiquement
          await this.fileAttenteService.marquerAbsentEtAppelerSuivant(
            ticket.id,
            ticket.prestataireId
          );
        }
      }
    } catch (error) {
      this.logger.error('Erreur vérification absences:', error);
    }
  }

  // Notifier le client 1 min avant qu'il soit marqué absent
  @Cron(CronExpression.EVERY_MINUTE)
  async notifierAvantAbsence() {
    try {
      const maintenant = new Date();

      const snapshot = await this.firebase.collection('tickets')
        .where('statut', '==', 'APPELE')
        .get();

      if (snapshot.empty) return;

      for (const doc of snapshot.docs) {
        const ticket = doc.data();

        const appeleLe = ticket.updatedAt?.toDate?.() || ticket.createdAt?.toDate?.();
        if (!appeleLe) continue;

        const minutesEcoulees = (maintenant.getTime() - appeleLe.getTime()) / 60000;

        // À 2 min écoulées → avertir qu'il reste 1 min
        if (minutesEcoulees >= DELAI_ABSENCE_MINUTES - 1 && minutesEcoulees < DELAI_ABSENCE_MINUTES) {
          try {
            await this.notificationService.envoyerNotification(ticket.clientId, {
              type: 'AVERTISSEMENT_ABSENCE',
              titre: '⚠️ Dernière chance !',
              message: 'Il vous reste 1 minute pour vous présenter, sinon votre ticket sera annulé.',
              data: { ticketId: ticket.id },
            });
          } catch (e) {
            this.logger.warn('Notification avertissement échouée:', e);
          }
        }
      }
    } catch (error) {
      this.logger.error('Erreur notification avant absence:', error);
    }
  }
}