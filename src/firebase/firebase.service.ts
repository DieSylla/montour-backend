import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as serviceAccount from '../../serviceAccountKey.json';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firestore: admin.firestore.Firestore;
  private messaging: admin.messaging.Messaging;
  private auth: admin.auth.Auth;

  onModuleInit() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(
          serviceAccount as admin.ServiceAccount
        ),
      });
    }
    this.firestore = admin.firestore();
    this.messaging = admin.messaging();
    this.auth = admin.auth();
  }

  getFirestore(): admin.firestore.Firestore {
    return this.firestore;
  }

  getMessaging(): admin.messaging.Messaging {
    return this.messaging;
  }

  getAuth(): admin.auth.Auth {
    return this.auth;
  }

  collection(name: string) {
    return this.firestore.collection(name);
  }

  async runTransaction<T>(fn: (t: admin.firestore.Transaction) => Promise<T>): Promise<T> {
    return this.firestore.runTransaction(fn);
  }
}