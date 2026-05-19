import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { NotificationService } from '../notification/notification.service';
import { FileAttenteService } from '../file-attente/file-attente.service';

@Injectable()
export class ReservationService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly notificationService: NotificationService,
    private readonly fileAttenteService: FileAttenteService,
  ) {}

  async creerReservation(clientId: string, dto: { creneauId: string; prestataireId: string; entrepriseId: string }) {
    return await this.firebase.runTransaction(async (transaction) => {
      const creneauRef = this.firebase.collection('creneaux').doc(dto.creneauId);
      const creneauDoc = await transaction.get(creneauRef);

      if (!creneauDoc.exists) throw new NotFoundException('Créneau introuvable');
      const creneau = creneauDoc.data();
      if (creneau.statut !== 'DISPONIBLE') throw new BadRequestException('Créneau non disponible');

      const prestDoc = await transaction.get(this.firebase.collection('users').doc(dto.prestataireId));
      const prestataire = prestDoc.data();
      const mode = prestataire?.confirmationMode || 'auto';

      const reservRef = this.firebase.collection('reservations').doc();
      const statut = mode === 'auto' ? 'CONFIRMEE' : 'EN_ATTENTE';
      const creneauStatut = mode === 'auto' ? 'RESERVE' : 'BLOQUE';

      const date = creneau.date || null;
      const heureDebut = creneau.heureDebut || null;
      const heureFin = creneau.heureFin || null;
      const dureePrestation = creneau.dureePrestation || null;
      const specialite = prestataire?.specialite || null;

      // Nom du prestataire pour l'affichage côté client
      const prestataireNom = prestataire
        ? `${prestataire.prenom} ${prestataire.nom}`
        : null;

      transaction.set(reservRef, {
        id: reservRef.id,
        clientId,
        prestataireId: dto.prestataireId,
        prestataireNom,
        entrepriseId: dto.entrepriseId || prestataire?.entrepriseId || null,
        creneauId: dto.creneauId,
        date,
        heureDebut,
        heureFin,
        dureePrestation,
        specialite,
        dateHeure: creneau.dateHeure || null,
        statut,
        confirmationMode: mode,
        createdAt: new Date(),
        expiresAt: mode === 'manual' ? new Date(Date.now() + 2 * 60 * 60 * 1000) : null,
      });

      transaction.update(creneauRef, { statut: creneauStatut });

      return { reservationId: reservRef.id, statut, mode };
    });
  }

  async getMesReservations(clientId: string) {
    try {
      const snapshot = await this.firebase.collection('reservations')
        .where('clientId', '==', clientId)
        .get();
      if (snapshot.empty) return [];
      return snapshot.docs
        .map(d => d.data())
        .sort((a, b) => b.createdAt?.toMillis?.() - a.createdAt?.toMillis?.());
    } catch (error) {
      console.error('ERREUR getMesReservations:', error);
      throw error;
    }
  }

  async getReservationsPrestataire(prestataireId: string) {
    try {
      const snapshot = await this.firebase.collection('reservations')
        .where('prestataireId', '==', prestataireId)
        .get();
      if (snapshot.empty) return [];
      return snapshot.docs
        .map(d => d.data())
        .sort((a, b) => a.createdAt?.toMillis?.() - b.createdAt?.toMillis?.());
    } catch (error) {
      console.error('ERREUR getReservationsPrestataire:', error);
      throw error;
    }
  }

  async annulerReservation(reservationId: string, clientId: string) {
    const doc = await this.firebase.collection('reservations').doc(reservationId).get();
    if (!doc.exists) throw new NotFoundException('Réservation introuvable');
    const reservation = doc.data();
    if (reservation.clientId !== clientId) throw new BadRequestException('Action non autorisée');
    if (reservation.statut === 'REFUSEE' || reservation.statut === 'ANNULEE') {
      throw new BadRequestException('Réservation déjà annulée');
    }

    await this.firebase.runTransaction(async (t) => {
      t.update(this.firebase.collection('reservations').doc(reservationId), {
        statut: 'ANNULEE', updatedAt: new Date(),
      });
      t.update(this.firebase.collection('creneaux').doc(reservation.creneauId), {
        statut: 'DISPONIBLE',
      });
    });

    try {
      await this.fileAttenteService.recalculerApresAnnulationRdv(
        reservation.prestataireId, reservation.creneauId
      );
    } catch (e) { console.warn('Recalcul file échoué:', e); }

    try {
      await this.notificationService.envoyerNotification(reservation.prestataireId, {
        type: 'RDV_ANNULE',
        titre: 'RDV annulé',
        message: 'Un client a annulé son rendez-vous. Le créneau est à nouveau disponible.',
        data: { reservationId },
      });
    } catch (e) { console.warn('Notification échouée:', e); }

    return { message: 'Réservation annulée. Le créneau est à nouveau disponible.' };
  }

  async repondreReservation(reservationId: string, prestataireId: string, decision: 'valider' | 'refuser', motif?: string) {
    const doc = await this.firebase.collection('reservations').doc(reservationId).get();
    if (!doc.exists) throw new NotFoundException('Réservation introuvable');
    const reservation = doc.data();

    const newStatut = decision === 'valider' ? 'CONFIRMEE' : 'REFUSEE';
    const creneauStatut = decision === 'valider' ? 'RESERVE' : 'DISPONIBLE';

    await this.firebase.runTransaction(async (t) => {
      t.update(this.firebase.collection('reservations').doc(reservationId), {
        statut: newStatut, messagePrestataire: motif || null, updatedAt: new Date(),
      });
      t.update(this.firebase.collection('creneaux').doc(reservation.creneauId), {
        statut: creneauStatut
      });
    });

    if (decision === 'refuser') {
      try {
        await this.fileAttenteService.recalculerApresAnnulationRdv(
          reservation.prestataireId, reservation.creneauId
        );
      } catch (e) { console.warn('Recalcul file échoué:', e); }
    }

    try {
      await this.notificationService.envoyerNotification(reservation.clientId, {
        type: decision === 'valider' ? 'RDV_CONFIRME' : 'RDV_REFUSE',
        titre: decision === 'valider' ? 'RDV confirmé !' : 'RDV refusé',
        message: decision === 'valider'
          ? `Votre rendez-vous est confirmé`
          : `Votre demande a été refusée${motif ? ` : ${motif}` : ''}`,
        data: { reservationId },
      });
    } catch (e) { console.warn('Notification échouée:', e); }

    return { message: `Réservation ${newStatut.toLowerCase()}` };
  }

  async marquerAbsent(reservationId: string, prestataireId: string) {
    const doc = await this.firebase.collection('reservations').doc(reservationId).get();
    if (!doc.exists) throw new NotFoundException('Réservation introuvable');
    const reservation = doc.data();
    if (reservation.prestataireId !== prestataireId) throw new BadRequestException('Action non autorisée');

    await this.firebase.runTransaction(async (t) => {
      t.update(this.firebase.collection('reservations').doc(reservationId), {
        statut: 'MANQUE', updatedAt: new Date(),
      });
      t.update(this.firebase.collection('creneaux').doc(reservation.creneauId), {
        statut: 'DISPONIBLE',
      });
    });

    try {
      await this.fileAttenteService.recalculerApresAnnulationRdv(
        reservation.prestataireId, reservation.creneauId
      );
    } catch(e) { console.warn('Recalcul échoué:', e); }

    try {
      await this.notificationService.envoyerNotification(reservation.clientId, {
        type: 'RDV_MANQUE',
        titre: 'RDV manqué',
        message: 'Vous n\'étiez pas présent à votre rendez-vous. Il a été annulé.',
        data: { reservationId },
      });
    } catch(e) { console.warn('Notification échouée:', e); }

    return { message: 'Client marqué absent. Le créneau est libéré.' };
  }

  async supprimerReservation(reservationId: string, prestataireId: string) {
    const doc = await this.firebase.collection('reservations').doc(reservationId).get();
    if (!doc.exists) throw new NotFoundException('Réservation introuvable');
    const reservation = doc.data();
    if (reservation.prestataireId !== prestataireId) throw new BadRequestException('Action non autorisée');

    const statutsAutorisés = ['TERMINE', 'ANNULEE', 'REFUSEE', 'MANQUE'];
    if (!statutsAutorisés.includes(reservation.statut)) {
      throw new BadRequestException('Impossible de supprimer un RDV actif');
    }

    await this.firebase.collection('reservations').doc(reservationId).delete();
    return { message: 'Réservation supprimée' };
  }

  async getReservationsCreneau(creneauId: string, prestataireId: string) {
    const snapshot = await this.firebase.collection('reservations')
      .where('creneauId', '==', creneauId)
      .where('prestataireId', '==', prestataireId)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  async notifierApresReservation(reservationId: string) {
    const doc = await this.firebase.collection('reservations').doc(reservationId).get();
    if (!doc.exists) return;
    const r = doc.data();

    await this.notificationService.envoyerNotification(r.clientId, {
      type: 'RESERVATION_CREEE',
      titre: r.statut === 'CONFIRMEE' ? '✅ RDV confirmé !' : '⏳ RDV en attente',
      message: r.statut === 'CONFIRMEE'
        ? `Votre RDV du ${r.date} à ${r.heureDebut} est confirmé.`
        : `Votre demande du ${r.date} à ${r.heureDebut} est en attente de confirmation.`,
      data: { reservationId, date: r.date, heure: r.heureDebut },
    });

    await this.notificationService.envoyerNotification(r.prestataireId, {
      type: 'NOUVELLE_RESERVATION',
      titre: '📅 Nouvelle réservation',
      message: `Un client vient de réserver le ${r.date} à ${r.heureDebut}.`,
      data: { reservationId, date: r.date, heure: r.heureDebut },
    });
  }

  async notifierAnnulation(reservationId: string) {
    const doc = await this.firebase.collection('reservations').doc(reservationId).get();
    if (!doc.exists) return;
    const r = doc.data();

    await this.notificationService.envoyerNotification(r.prestataireId, {
      type: 'RESERVATION_ANNULEE',
      titre: '❌ RDV annulé',
      message: `Un client a annulé son RDV du ${r.date} à ${r.heureDebut}.`,
      data: { reservationId, date: r.date, heure: r.heureDebut },
    });

    await this.notificationService.envoyerNotification(r.clientId, {
      type: 'RESERVATION_ANNULEE',
      titre: '❌ RDV annulé',
      message: `Votre RDV du ${r.date} à ${r.heureDebut} a été annulé.`,
      data: { reservationId },
    });
  }
}