export enum StatutEntreprise {
  EN_ATTENTE = 'EN_ATTENTE',
  VALIDEE = 'VALIDEE',
  REJETEE = 'REJETEE',
  SUSPENDUE = 'SUSPENDUE',
}

export class EntrepriseEntity {
  id: string;
  codeHex: string;             // Code hexadécimal unique généré par admin
  nom: string;
  nomResponsable: string;
  typeService: string;         // clinique, garage, station_lavage...
  specialites: string[];       // ['ophtalmologie', 'cardiologie'...]
  ninea: string;
  adresse: string;
  latitude: number;
  longitude: number;
  statut: StatutEntreprise;
  email: string;
  telephone: string;
  createdAt: Date;
  validatedAt?: Date;
}
