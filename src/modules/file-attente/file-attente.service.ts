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

    // 1. Récupérer les RDV confirmés du jour
    const rdvSnapshot = await this.firebase.collection('reservations')
      .where('prestataireId', '==', prestataireId)
      .where('date', '==', today)
      .where('statut', '==', 'CONFIRMEE')
      .get();

    const rdvDuJour = rdvSnapshot.docs
      .map(d => d.data())
      .sort((a, b) => a.heureDebut?.localeCompare(b.heureDebut));

    // 2. Récupérer les tickets immédiats en attente
    const ticketsSnapshot = await this.firebase.collection('tickets')
      .where('prestataireId', '==', prestataireId)
      .where('statut', '==', 'EN_ATTENTE')
      .get();

    const ticketsEnAttente = ticketsSnapshot.docs
      .map(d => d.data())
      .sort((a, b) => a.rang - b.rang);

    // 3. Construire la file combinée
    const heureActuelle = new Date();
    const heureActuelleStr = heureActuelle.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Trouver les créneaux libres entre les RDV
    const creneauxOccupes = rdvDuJour.map(r => r.heureDebut);

    // Calculer le rang en tenant compte des RDV futurs
    const rdvFuturs = rdvDuJour.filter(r => r.heureDebut > heureActuelleStr);
    const nbTicketsEnAttente = ticketsEnAttente.length;

    // Trouver la meilleure position pour le nouveau ticket
    let rang = nbTicketsEnAttente + 1;
    let tempsEstime = rang * DUREE_MOYENNE_PAR_CLIENT;

    // Si des RDV sont planifiés, vérifier s'il y a des trous
    if (rdvFuturs.length > 0) {
      const positionOptimale = this.trouverPositionOptimale(
        rdvFuturs,
        ticketsEnAttente,
        heureActuelleStr
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
    // Construire la timeline de la journée
    const timeline: { heure: string; type: 'rdv' | 'ticket' }[] = [];

    // Ajouter les RDV
    rdvFuturs.forEach(rdv => {
      timeline.push({ heure: rdv.heureDebut, type: 'rdv' });
    });

    // Ajouter les tickets existants
    ticketsEnAttente.forEach((_, index) => {
      timeline.push({ heure: `ticket_${index}`, type: 'ticket' });
    });

    // Trier par heure
    timeline.sort((a, b) => {
      if (a.type === 'ticket') return 1;
      if (b.type === 'ticket') return -1;
      return a.heure.localeCompare(b.heure);
    });

    // Trouver le premier trou disponible
    let position = 1;
    let trouveUnTrou = false;

    for (let i = 0; i < rdvFuturs.length - 1; i++) {
      const heureRdv1 = rdvFuturs[i].heureDebut;
      const heureRdv2 = rdvFuturs[i + 1].heureDebut;

      // Vérifier s'il y a un trou entre deux RDV
      const minutes1 = this.heureEnMinutes(heureRdv1);
      const minutes2 = this.heureEnMinutes(heureRdv2);
      const diff = minutes2 - minutes1;

      // Compter les tickets déjà dans ce trou
      const ticketsDansTrou = ticketsEnAttente.filter(t => {
        const tempsTicket = this.heureEnMinutes(heureActuelle) + (t.rang * DUREE_MOYENNE_PAR_CLIENT);
        return tempsTicket >= minutes1 && tempsTicket < minutes2;
      }).length;

      // Si le trou peut accueillir un ticket supplémentaire
      if (diff > DUREE_MOYENNE_PAR_CLIENT && ticketsDansTrou === 0) {
        position = i + 2; // Après le premier RDV
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
    // Quand un RDV est annulé, vérifier s'il y a des tickets en attente
    // et leur proposer de prendre ce créneau libéré
    const ticketsSnapshot = await this.firebase.collection('tickets')
      .where('prestataireId', '==', prestataireId)
      .where('statut', '==', 'EN_ATTENTE')
      .orderBy('rang', 'asc')
      .get();

    if (ticketsSnapshot.empty) return;

    // Notifier le premier de la file que son temps d'attente a diminué
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

    // Recalculer les rangs de tous les tickets
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