import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';

interface SendNotifDto {
  type: string;
  titre: string;
  message: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationService {
  constructor(private readonly firebase: FirebaseService) {}

  async envoyerNotification(userId: string, notif: SendNotifDto) {
    const notifRef = this.firebase.collection('notifications').doc();
    await notifRef.set({
      id: notifRef.id,
      userId,
      type: notif.type,
      titre: notif.titre,
      message: notif.message,
      data: notif.data || {},
      lu: false,
      createdAt: new Date(),
    });

    const userDoc = await this.firebase.collection('users').doc(userId).get();
    if (!userDoc.exists) return;

    const user = userDoc.data();
    if (!user.fcmToken) return;

    try {
      await this.firebase.getMessaging().send({
        token: user.fcmToken,
        notification: {
          title: notif.titre,
          body: notif.message,
        },
        data: {
          type: notif.type,
          ...Object.fromEntries(
            Object.entries(notif.data || {}).map(([k, v]) => [k, String(v)])
          ),
        },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
    } catch (err: any) {
      console.error(`Erreur FCM pour user ${userId}:`, err.message);
    }
  }

  async getNotifications(userId: string) {
    const uneSemanneAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const snapshot = await this.firebase.collection('notifications')
      .where('userId', '==', userId)
      .where('createdAt', '>', uneSemanneAgo)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    return snapshot.docs.map(d => d.data());
  }

  async marquerCommeLu(notifId: string, userId: string) {
    await this.firebase.collection('notifications').doc(notifId).update({ lu: true });
    return { message: 'Notification marquée comme lue' };
  }
}