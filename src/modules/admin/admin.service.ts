import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';

@Injectable()
export class AdminService {
  constructor(private readonly firebase: FirebaseService) {}

  async getStats() {
    const [users, entreprises, tickets] = await Promise.all([
      this.firebase.collection('users').count().get(),
      this.firebase.collection('entreprises').count().get(),
      this.firebase.collection('tickets').count().get(),
    ]);
    return {
      totalUsers: users.data().count,
      totalEntreprises: entreprises.data().count,
      totalTickets: tickets.data().count,
    };
  }

  async getAllUsers() {
    const snapshot = await this.firebase.collection('users').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(d => { const { otp, otpExpires, ...u } = d.data() as any; return u; });
  }
}
