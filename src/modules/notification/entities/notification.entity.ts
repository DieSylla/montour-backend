export enum NotificationType {
  TICKET_CREE = 'TICKET_CREE',
  TOUR_APPROCHE = 'TOUR_APPROCHE',
  CEST_TON_TOUR = 'CEST_TON_TOUR',
  TICKET_ANNULE = 'TICKET_ANNULE',
  RDV_CONFIRME = 'RDV_CONFIRME',
  RDV_REFUSE = 'RDV_REFUSE',
  RAPPEL_RDV = 'RAPPEL_RDV',
  ABSENCE_DETECTEE = 'ABSENCE_DETECTEE',
  COMPTE_VALIDE = 'COMPTE_VALIDE',
  CODE_ENTREPRISE = 'CODE_ENTREPRISE',
  OTP = 'OTP',
}

export class NotificationEntity {
  id: string;
  userId: string;
  type: NotificationType;
  titre: string;
  message: string;
  lu: boolean;
  data?: Record<string, any>; // Données supplémentaires
  createdAt: Date;
}
