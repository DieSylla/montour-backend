export enum TicketStatut {
  EN_ATTENTE = 'EN_ATTENTE',
  APPELE = 'APPELE',
  EN_COURS = 'EN_COURS',
  TERMINE = 'TERMINE',
  ANNULE = 'ANNULE',
  ABSENT = 'ABSENT',
}

export class TicketEntity {
  id: string;
  numero: number;              // Numéro dans la file (1, 2, 3...)
  rang: number;                // Position actuelle en temps réel
  clientId: string;
  prestataireId: string;
  entrepriseId: string;
  specialite: string;
  statut: TicketStatut;
  tempsAttenteEstime: number;  // En minutes
  clientLatitude?: number;     // Pour vérification présence
  clientLongitude?: number;
  createdAt: Date;
  appelleAt?: Date;
  termineAt?: Date;
}
