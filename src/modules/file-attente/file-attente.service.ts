import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { NotificationService } from '../notification/notification.service';

const DUREE_MOYENNE_PAR_CLIENT = 10;
const DISTANCE_MAX_METRES = 200;
const DELAI_GRACE_MINUTES = 3;

@Injectable()
export class FileAttenteService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly notificationService: NotificationService,
  ) {}

  async calculerPosition(prestataireId: string) {
    const today = new Date().toLocaleDateString('fr-FR');

    const rdvSnapshot = await this.firebase.collection('reservations')
      .where('prestataireId', '==', prestataireId)
      .where('date', '==', today)
      .where('statut', '==', 'CONFIRMEE')
      .get();

    const rdvDuJour = rdvSnapshot.docs
      .map(d => d.data())
      .sort((a, b) => a.heureDebut?.localeCompare(b.heureDebut));

    const ticketsSnapshot = await this.firebase.collection('tickets')
      .where('prestataireId', '==', prestataireId)
      .where('statut', '==', 'EN_ATTENTE')
      .get();

    const ticketsEnAttente = ticketsSnapshot.docs
      .map(d => d.data())
      .sort((a, b) => a.rang - b.rang);

    const heureActuelle = new Date();
    const heureActuelleStr = heureActuelle.toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit'
    });

    const rdvFuturs = rdvDuJour.filter(r => r.heureDebut > heureActuelleStr);
    const nbTicketsEnAttente = ticketsEnAttente.length;

    let rang = nbTicketsEnAttente + 1;
    let tempsEstime = rang * DUREE_MOYENNE_PAR_CLIENT;

    if (rdvFuturs.length > 0) {
      const positionOptimale = this.trouverPositionOptimale(
        rdvFuturs, ticketsEnAttente, heureActuelleStr
      );
      rang = positionOptimale.rang;
      tempsEstime = positionOptimale.tempsEstime;
    }

    const numero = await this.getProchainNumero(prestataireId);
    return { rang, numero, tempsEstime };
  }

  private trouverPositionOptimale(
    rdvFuturs: any[],
    ticketsEnAttente: any[],
    heureActuelle: string
  ): { rang: number; tempsEstime: number } {
    const timeline: { heure: string; type: 'rdv' | 'ticket' }[] = [];

    rdvFuturs.forEach(rdv => {
      timeline.push({ heure: rdv.heureDebut, type: 'rdv' });
    });

    ticketsEnAttente.forEach((_, index) => {
      timeline.push({ heure: `ticket_${index}`, type: 'ticket' });
    });

    timeline.sort((a, b) => {
      if (a.type === 'ticket') return 1;
      if (b.type === 'ticket') return -1;
      return a.heure.localeCompare(b.heure);
    });

    let position = 1;
    let trouveUnTrou = false;

    for (let i = 0; i < rdvFuturs.length - 1; i++) {
      const heureRdv1 = rdvFuturs[i].heureDebut;
      const heureRdv2 = rdvFuturs[i + 1].heureDebut;
      const minutes1 = this.heureEnMinutes(heureRdv1);
      const minutes2 = this.heureEnMinutes(heureRdv2);
      const diff = minutes2 - minutes1;

      const ticketsDansTrou = ticketsEnAttente.filter(t => {
        const tempsTicket = this.heureEnMinutes(heureActuelle) + (t.rang * DUREE_MOYENNE_PAR_CLIENT);
        return tempsTicket >= minutes1 && tempsTicket < minutes2;
      }).length;

      if (diff > DUREE_MOYENNE_PAR_CLIENT && ticketsDansTrou === 0) {
        position = i + 2;
        trouveUnTrou = true;
        break;
      }
    }

    if (!trouveUnTrou) {
      position = ticketsEnAttente.length + rdvFuturs.length + 1;
    }

    const tempsEstime = position * DUREE_MOYENNE_PAR_CLIENT;
    return { rang: position, tempsEstime };
  }

  private heureEnMinutes(heure: string): number {
    if (!heure || heure.includes('ticket_')) return 0;
    const [h, m] = heure.split(':').map(Number);
    return h * 60 + m;
  }

  // ── Notifier le suivant qu'il doit se préparer ─────────────────────
  async notifierSuivant(prestataireId: string) {
    try {
      const snapshot = await this.firebase.collection('tickets')
        .where('prestataireId', '==', prestataireId)
        .where('statut', '==', 'EN_ATTENTE')
        .orderBy('rang', 'asc')
        .get();

      if (snapshot.empty) return;

      // Le client en rang 1 = prochain à être appelé
      const premierTicket = snapshot.docs[0].data();

      await this.notificationService.envoyerNotification(premierTicket.clientId, {
        type: 'PREPAREZ_VOUS',
        titre: '⏰ Préparez-vous !',
        message: 'Vous êtes le prochain dans la file. Tenez-vous prêt, c\'est bientôt votre tour.',
        data: { ticketId: premierTicket.id, rang: 1 },
      });
    } catch (e) {
      console.warn('Notification suivant échouée:', e);
    }
  }

  // ── Gérer l'absence d'un client ────────────────────────────────────
  async marquerAbsentEtAppelerSuivant(ticketId: string, prestataireId: string) {
    const ticketDoc = await this.firebase.collection('tickets').doc(ticketId).get();
    if (!ticketDoc.exists) return;

    const ticket = ticketDoc.data();

    // 1. Marquer le client comme absent
    await this.firebase.collection('tickets').doc(ticketId).update({
      statut: 'ABSENT',
      updatedAt: new Date(),
    });

    // 2. Notifier le client absent
    try {
      await this.notificationService.envoyerNotification(ticket.clientId, {
        type: 'TICKET_ABSENT',
        titre: 'Ticket annulé',
        message: 'Vous avez été marqué absent. Votre ticket a été annulé.',
        data: { ticketId },
      });
    } catch (e) {
      console.warn('Notification absent échouée:', e);
    }

    // 3. Recalculer la file
    await this.recalculerApresAnnulation(prestataireId, ticket.rang);

    // 4. Appeler automatiquement le suivant
    const suivantSnapshot = await this.firebase.collection('tickets')
      .where('prestataireId', '==', prestataireId)
      .where('statut', '==', 'EN_ATTENTE')
      .orderBy('rang', 'asc')
      .get();

    if (!suivantSnapshot.empty) {
      const suivant = suivantSnapshot.docs[0];
      const suivantData = suivant.data();

      // Mettre à jour le statut du suivant
      await suivant.ref.update({
        statut: 'APPELE',
        updatedAt: new Date(),
      });

      // Notifier le suivant que c'est son tour
      try {
        await this.notificationService.envoyerNotification(suivantData.clientId, {
          type: 'TICKET_APPELE',
          titre: '📣 C\'est votre tour !',
          message: 'Le prestataire vous appelle. Présentez-vous maintenant.',
          data: { ticketId: suivant.id },
        });
      } catch (e) {
        console.warn('Notification suivant échouée:', e);
      }
    }

    return { message: 'Client marqué absent. Le suivant a été appelé automatiquement.' };
  }

  async recalculerApresAnnulation(prestataireId: string, rangAnnule: number) {
    const snapshot = await this.firebase.collection('tickets')
      .where('prestataireId', '==', prestataireId)
      .where('statut', '==', 'EN_ATTENTE')
      .where('rang', '>', rangAnnule)
      .orderBy('rang', 'asc')
      .get();

    const batch = this.firebase.getFirestore().batch();

    for (const doc of snapshot.docs) {
      const ticket = doc.data();
      const nouveauRang = ticket.rang - 1;
      const nouveauTemps = nouveauRang * DUREE_MOYENNE_PAR_CLIENT;

      batch.update(doc.ref, {
        rang: nouveauRang,
        tempsAttenteEstime: nouveauTemps,
        updatedAt: new Date(),
      });

      // Notifier chaque client que son rang a avancé
      try {
        await this.notificationService.envoyerNotification(ticket.clientId, {
          type: 'RANG_MISE_A_JOUR',
          titre: 'File mise à jour',
          message: `Votre rang est maintenant ${nouveauRang}. Temps estimé : ${nouveauTemps} min`,
          data: { rang: nouveauRang, tempsEstime: nouveauTemps },
        });
      } catch (e) {
        console.warn('Notification échouée:', e);
      }
    }

    await batch.commit();
  }

  async recalculerApresAnnulationRdv(prestataireId: string, creneauId: string) {
    const ticketsSnapshot = await this.firebase.collection('tickets')
      .where('prestataireId', '==', prestataireId)
      .where('statut', '==', 'EN_ATTENTE')
      .orderBy('rang', 'asc')
      .get();

    if (ticketsSnapshot.empty) return;

    const premierTicket = ticketsSnapshot.docs[0].data();
    try {
      await this.notificationService.envoyerNotification(premierTicket.clientId, {
        type: 'RANG_MISE_A_JOUR',
        titre: 'Bonne nouvelle !',
        message: 'Un créneau s\'est libéré ! Votre temps d\'attente a diminué.',
        data: { ticketId: premierTicket.id },
      });
    } catch (e) {
      console.warn('Notification échouée:', e);
    }

    const batch = this.firebase.getFirestore().batch();
    ticketsSnapshot.docs.forEach((doc, index) => {
      const nouveauRang = index + 1;
      const nouveauTemps = nouveauRang * DUREE_MOYENNE_PAR_CLIENT;
      batch.update(doc.ref, {
        rang: nouveauRang,
        tempsAttenteEstime: nouveauTemps,
        updatedAt: new Date(),
      });
    });
    await batch.commit();
  }

  async verifierPresenceClient(
    ticketId: string,
    prestataireLatitude: number,
    prestataireLongitude: number
  ) {
    const ticketDoc = await this.firebase.collection('tickets').doc(ticketId).get();
    const ticket = ticketDoc.data();

    if (!ticket.clientLatitude || !ticket.clientLongitude) {
      await this.notificationService.envoyerNotification(ticket.clientId, {
        type: 'ABSENCE_DETECTEE',
        titre: 'Êtes-vous là ?',
        message: `C'est votre tour ! Confirmez dans ${DELAI_GRACE_MINUTES} minutes sinon votre ticket sera annulé.`,
        data: { ticketId, delaiGrace: DELAI_GRACE_MINUTES },
      });
      return false;
    }

    const distance = this.calculerDistance(
      ticket.clientLatitude, ticket.clientLongitude,
      prestataireLatitude, prestataireLongitude
    );

    if (distance > DISTANCE_MAX_METRES) {
      await this.notificationService.envoyerNotification(ticket.clientId, {
        type: 'ABSENCE_DETECTEE',
        titre: 'Vous semblez absent',
        message: `Présentez-vous dans ${DELAI_GRACE_MINUTES} min.`,
        data: { ticketId, distance: Math.round(distance), delaiGrace: DELAI_GRACE_MINUTES },
      });
      return false;
    }

    return true;
  }

  private calculerDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371000;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dphi = (lat2 - lat1) * Math.PI / 180;
    const dlambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dphi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async getProchainNumero(prestataireId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const snapshot = await this.firebase.collection('tickets')
      .where('prestataireId', '==', prestataireId)
      .where('createdAt', '>=', today)
      .get();
    return snapshot.size + 1;
  }
}