import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketStatut } from './entities/ticket.entity';
import { NotificationService } from '../notification/notification.service';
import { FileAttenteService } from '../file-attente/file-attente.service';

@Injectable()
export class TicketService {
  private readonly logger = new Logger(TicketService.name);
  constructor(
    private readonly firebase: FirebaseService,
    private readonly notificationService: NotificationService,
    private readonly fileAttenteService: FileAttenteService,
  ) {}

  async creerTicket(clientId: string, dto: CreateTicketDto) {
    try {
      const ticketExistant = await this.firebase.collection('tickets')
        .where('clientId', '==', clientId)
        .where('prestataireId', '==', dto.prestataireId)
        .where('statut', 'in', [TicketStatut.EN_ATTENTE, TicketStatut.APPELE])
        .get();

      if (!ticketExistant.empty) {
        throw new BadRequestException('Vous avez déjà un ticket actif chez ce prestataire');
      }

      const { numero, rang, tempsEstime } = await this.fileAttenteService.calculerPosition(dto.prestataireId);

      // Récupérer le nom de l'entreprise
      let entrepriseNom = null;
      if (dto.entrepriseId) {
        try {
          const entrepriseDoc = await this.firebase.collection('entreprises').doc(dto.entrepriseId).get();
          if (entrepriseDoc.exists) {
            entrepriseNom = entrepriseDoc.data()?.nom || null;
          }
        } catch (e) {
          console.warn('Récupération entrepriseNom échouée (non bloquant):', e);
        }
      }

      const ticketRef = this.firebase.collection('tickets').doc();
      const ticket = {
        id: ticketRef.id,
        numero,
        rang,
        clientId,
        prestataireId: dto.prestataireId,
        entrepriseId: dto.entrepriseId,
        entrepriseNom,
        specialite: dto.specialite,
        statut: TicketStatut.EN_ATTENTE,
        tempsAttenteEstime: tempsEstime,
        clientLatitude: dto.clientLatitude || null,
        clientLongitude: dto.clientLongitude || null,
        createdAt: new Date(),
      };

      await ticketRef.set(ticket);
      console.log('Ticket créé avec succès:', ticket);

      try {
        await this.notificationService.envoyerNotification(clientId, {
          type: 'TICKET_CREE',
          titre: 'Ticket créé',
          message: `Votre numéro est le ${numero}. Temps d'attente estimé : ${tempsEstime} min`,
          data: { ticketId: ticketRef.id, rang, tempsEstime },
        });
      } catch (notifError) {
        console.warn('Notification échouée (non bloquant):', (notifError as any).message);
      }

      return ticket;

    } catch (error) {
      console.error('ERREUR creerTicket:', error);
      throw error;
    }
  }

  async annulerTicket(ticketId: string, clientId: string) {
    console.log('ticketId reçu:', ticketId);
    console.log('clientId reçu:', clientId);

    const ticketDoc = await this.firebase.collection('tickets').doc(ticketId).get();
    console.log('ticket existe?', ticketDoc.exists);

    if (!ticketDoc.exists) throw new NotFoundException('Ticket introuvable');

    const ticket = ticketDoc.data();
    console.log('clientId dans ticket:', ticket.clientId);
    console.log('match?', ticket.clientId === clientId);

    if (ticket.clientId !== clientId) throw new BadRequestException('Action non autorisée');
    if (ticket.statut === TicketStatut.TERMINE) throw new BadRequestException('Ticket déjà terminé');

    await this.firebase.collection('tickets').doc(ticketId).update({
      statut: TicketStatut.ANNULE,
      updatedAt: new Date(),
    });

    try {
      await this.fileAttenteService.recalculerApresAnnulation(ticket.prestataireId, ticket.rang);
    } catch (e) {
      console.warn('Recalcul file échoué (non bloquant):', (e as any).message);
    }

    return { message: 'Ticket annulé. La file a été mise à jour.' };
  }

  async getTicketActif(clientId: string) {
    try {
      const snapshot = await this.firebase.collection('tickets')
        .where('clientId', '==', clientId)
        .get();

      if (snapshot.empty) return null;

      const tickets = snapshot.docs
        .map(d => d.data())
        .filter(t => t.statut === 'EN_ATTENTE' || t.statut === 'APPELE')
        .sort((a, b) => b.createdAt?.toMillis?.() - a.createdAt?.toMillis?.());

      return tickets.length > 0 ? tickets[0] : null;
    } catch (error) {
      console.error('ERREUR getTicketActif:', error);
      throw error;
    }
  }

  async getTicketsPrestataire(prestataireId: string) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snapshot = await this.firebase.collection('tickets')
      .where('prestataireId', '==', prestataireId)
      .where('createdAt', '>=', today)
      .get();

    if (snapshot.empty) return [];

    return snapshot.docs.map(d => d.data());
  } catch (error) {
    console.error('ERREUR getTicketsPrestataire:', error);
    throw error;
  }
}

  async appelerTicket(ticketId: string, prestataireId: string) {
  const ticketDoc = await this.firebase.collection('tickets').doc(ticketId).get();
  if (!ticketDoc.exists) throw new NotFoundException('Ticket introuvable');

  const ticket = ticketDoc.data();
  if (ticket.prestataireId !== prestataireId) throw new BadRequestException('Action non autorisée');

  // Récupérer la position du prestataire
  const prestataireDoc = await this.firebase.collection('users').doc(prestataireId).get();
  const prestataire = prestataireDoc.data();

  // Mettre à jour statut → APPELÉ
  await this.firebase.collection('tickets').doc(ticketId).update({
    statut: 'APPELE',
    updatedAt: new Date(),
  });

  // Vérifier présence GPS si disponible
  if (prestataire?.latitude && prestataire?.longitude) {
    const estPresent = await this.fileAttenteService.verifierPresenceClient(
      ticketId,
      prestataire.latitude,
      prestataire.longitude
    );

    if (!estPresent) {
      // Client potentiellement absent — le scheduler s'en occupera dans 3 min
      this.logger.log(`Client potentiellement absent : ${ticketId}`);
      return { message: 'Client appelé. Vérification de présence en cours.' };
    }
  }

  // Notifier le client que c'est son tour
  try {
    await this.notificationService.envoyerNotification(ticket.clientId, {
      type: 'TICKET_APPELE',
      titre: '📣 C\'est votre tour !',
      message: 'Le prestataire vous appelle. Présentez-vous maintenant.',
      data: { ticketId },
    });
  } catch (e) {
    console.warn('Notification échouée:', e);
  }

  // Notifier le suivant de se préparer
  await this.fileAttenteService.notifierSuivant(prestataireId);

  return { message: 'Client appelé avec succès.' };
}

  async terminerTicket(ticketId: string, prestataireId: string) {
    const ticketDoc = await this.firebase.collection('tickets').doc(ticketId).get();
    if (!ticketDoc.exists) throw new NotFoundException('Ticket introuvable');

    const ticket = ticketDoc.data();
    if (ticket.prestataireId !== prestataireId) throw new BadRequestException('Action non autorisée');
    if (ticket.statut === TicketStatut.TERMINE) throw new BadRequestException('Ticket déjà terminé');

    await this.firebase.collection('tickets').doc(ticketId).update({
      statut: TicketStatut.TERMINE,
      updatedAt: new Date(),
    });

    try {
      await this.notificationService.envoyerNotification(ticket.clientId, {
        type: 'SERVICE_TERMINE',
        titre: 'Service terminé',
        message: 'Votre service est terminé. Merci de votre visite !',
        data: { ticketId },
      });
    } catch (e) {
      console.warn('Notification échouée:', (e as any).message);
    }

    return { message: 'Ticket terminé avec succès.' };
  }
}