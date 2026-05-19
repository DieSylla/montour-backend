export enum ReservationStatut {
  EN_ATTENTE = 'EN_ATTENTE',
  CONFIRMEE = 'CONFIRMEE',
  REFUSEE = 'REFUSEE',
  ANNULEE = 'ANNULEE',
  TERMINEE = 'TERMINEE',
}

export enum ConfirmationMode {
  AUTO = 'auto',
  MANUAL = 'manual',
}

export class ReservationEntity {
  id: string;
  clientId: string;
  prestataireId: string;
  entrepriseId: string;
  creneauId: string;
  dateHeure: Date;
  dureeMinutes: number;
  statut: ReservationStatut;
  confirmationMode: ConfirmationMode;
  messagePrestataire?: string; // Message en cas de refus
  createdAt: Date;
  expiresAt?: Date;            // Expiration si mode manuel sans réponse
}
