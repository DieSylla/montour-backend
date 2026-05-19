import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';

@Injectable()
export class UserService {
  constructor(private readonly firebase: FirebaseService) {}

  async getProfile(userId: string) {
    const doc = await this.firebase.collection('users').doc(userId).get();
    if (!doc.exists) throw new NotFoundException('Utilisateur introuvable');
    const { otp, otpExpires, ...user } = doc.data() as any;
    return user;
  }

  async updateFcmToken(userId: string, fcmToken: string) {
    await this.firebase.collection('users').doc(userId).update({ fcmToken, updatedAt: new Date() });
    return { message: 'Token FCM mis à jour' };
  }

  async updateProfile(userId: string, data: Partial<{ nom: string; prenom: string; telephone: string }>) {
    await this.firebase.collection('users').doc(userId).update({ ...data, updatedAt: new Date() });
    return { message: 'Profil mis à jour' };
  }
}
