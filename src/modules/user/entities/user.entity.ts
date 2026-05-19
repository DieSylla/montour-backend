export enum UserRole {
  CLIENT = 'CLIENT',
  PRESTATAIRE = 'PRESTATAIRE',
  ADMIN = 'ADMIN',
}

export class UserEntity {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  role: UserRole;
  fcmToken?: string;           // Token pour notifications push
  isVerified: boolean;         // OTP vérifié
  acceptedCGU: boolean;
  createdAt: Date;
  updatedAt: Date;
}
