import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketStatut } from './entities/ticket.entity';
import { NotificationService } from '../notification/notification.service';
import { FileAttenteService } from '../file-attente/file-attente.service';

@Injectable()
export class TicketService {
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

      const ticketRef = this.firebase.collection('tickets').doc();
      const ticket = {
        id: ticketRef.id,
        numero,
        rang,
        clientId,
        prestataireId: dto.prestataireId,
        entrepriseId: dto.entrepriseId,
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
      const snapshot = await this.firebase.collection('tickets')
        .where('prestataireId', '==', prestataireId)
        .get();

      if (snapshot.empty) return [];

      const tickets = snapshot.docs
        .map(d => d.data())
        .filter(t => t.statut === 'EN_ATTENTE' || t.statut === 'APPELE')
        .sort((a, b) => a.rang - b.rang);

      return tickets;
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

    await this.firebase.collection('tickets').doc(ticketId).update({
      statut: TicketStatut.APPELE,
      updatedAt: new Date(),
    });

    // Notifier le client
    try {
      await this.notificationService.envoyerNotification(ticket.clientId, {
        type: 'TICKET_APPELE',
        titre: 'C\'est votre tour !',
        message: 'Le prestataire vous appelle. Présentez-vous maintenant.',
        data: { ticketId },
      });
    } catch (e) {
      console.warn('Notification échouée:', (e as any).message);
    }

    return { message: 'Client appelé avec succès.' };
  }

  // ── Terminer un ticket ───────────────────────────────────────────────
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
