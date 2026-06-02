import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';

@Injectable()
export class AdminService {
  constructor(private readonly firebase: FirebaseService) {}

  async getStats() {
    const [users, entreprises] = await Promise.all([
      this.firebase.collection('users').get(),
      this.firebase.collection('entreprises').get(),
    ]);

    const usersData = users.docs.map(d => d.data());
    const entreprisesData = entreprises.docs.map(d => d.data());

    return {
      utilisateurs: {
        total: usersData.length,
        clients: usersData.filter(u => u.role === 'CLIENT').length,
        prestataires: usersData.filter(u => u.role === 'PRESTATAIRE').length,
      },
      entreprises: {
        total: entreprisesData.length,
        validees: entreprisesData.filter(e => e.statut === 'VALIDEE').length,
        enAttente: entreprisesData.filter(e => e.statut === 'EN_ATTENTE').length,
      },
    };
  }

  async getAllUsers() {
    const snapshot = await this.firebase.collection('users').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(d => {
      const { otp, otpExpires, ...u } = d.data() as any;
      return u;
    });
  }
}