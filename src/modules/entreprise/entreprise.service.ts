import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { CreateEntrepriseDto } from './dto/create-entreprise.dto';
import { NotificationService } from '../notification/notification.service';
import * as crypto from 'crypto';

@Injectable()
export class EntrepriseService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly notificationService: NotificationService,
  ) {}

  async demanderAdhesion(dto: CreateEntrepriseDto) {
    const existing = await this.firebase.collection('entreprises')
      .where('ninea', '==', dto.ninea).get();
    if (!existing.empty) throw new BadRequestException('Ce NINEA est déjà enregistré');

    const ref = this.firebase.collection('entreprises').doc();
    await ref.set({
      id: ref.id,
      ...dto,
      statut: 'EN_ATTENTE',
      codeHex: null,
      createdAt: new Date(),
    });

    return {
      message: 'Demande d\'adhésion soumise. L\'administrateur va examiner votre dossier.',
      entrepriseId: ref.id,
    };
  }

  async validerEntreprise(entrepriseId: string, adminId: string) {
    const doc = await this.firebase.collection('entreprises').doc(entrepriseId).get();
    if (!doc.exists) throw new NotFoundException('Entreprise introuvable');

    const codeHex = crypto.randomBytes(4).toString('hex').toUpperCase();

    await this.firebase.collection('entreprises').doc(entrepriseId).update({
      statut: 'VALIDEE',
      codeHex,
      validatedAt: new Date(),
      validatedBy: adminId,
    });

    const entreprise = doc.data();
    console.log(`Code pour ${entreprise.nom}: ${codeHex}`);

    return {
      message: `Entreprise validée. Code envoyé à ${entreprise.email}`,
      codeHex,
    };
  }

  async rejeterEntreprise(entrepriseId: string, motif: string) {
    await this.firebase.collection('entreprises').doc(entrepriseId).update({
      statut: 'REJETEE',
      motifRejet: motif,
      updatedAt: new Date(),
    });
    return { message: 'Demande rejetée' };
  }

  async getSpecialitesByCode(codeHex: string) {
    const snapshot = await this.firebase.collection('entreprises')
      .where('codeHex', '==', codeHex.toUpperCase())
      .where('statut', '==', 'VALIDEE')
      .get();

    if (snapshot.empty) throw new NotFoundException('Code entreprise invalide');
    const entreprise = snapshot.docs[0].data();
    return {
      entrepriseId: entreprise.id,
      nom: entreprise.nom,
      specialites: entreprise.specialites,
    };
  }

  async getPendingEntreprises() {
    const snapshot = await this.firebase.collection('entreprises')
      .where('statut', '==', 'EN_ATTENTE')
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(d => d.data());
  }

  async getToutesEntreprises() {
    const snapshot = await this.firebase.collection('entreprises')
      .where('statut', '==', 'VALIDEE')
      .get();
    return snapshot.docs.map(d => d.data());
  }

  async getPrestataires(entrepriseId: string) {
    const snapshot = await this.firebase.collection('users')
      .where('entrepriseId', '==', entrepriseId)
      .where('role', '==', 'PRESTATAIRE')
      .get();
    return snapshot.docs.map(d => {
      const u = d.data();
      const { password, otp, otpExpires, ...safe } = u;
      return safe;
    });
  }

  async toggleEntreprise(entrepriseId: string, active: boolean) {
  const doc = await this.firebase.collection('entreprises').doc(entrepriseId).get();
  if (!doc.exists) throw new NotFoundException('Entreprise introuvable');

  await this.firebase.collection('entreprises').doc(entrepriseId).update({
    active,
    updatedAt: new Date()
  });

  return { message: active ? 'Entreprise activée' : 'Entreprise désactivée', active };
}
}