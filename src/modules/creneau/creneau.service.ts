import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';

@Injectable()
export class CreneauService {
  constructor(private readonly firebase: FirebaseService) {}

  /**
   * Crée automatiquement les slots à partir d'une plage horaire.
   * Ex: 08:00 → 10:00, 30min = slots [08:00-08:30, 08:30-09:00, 09:00-09:30, 09:30-10:00]
   */
  async creerCreneau(prestataireId: string, dto: {
    heureDebut: string;
    heureFin: string;
    dureePrestation: number;
    dates: string[];
  }) {
    const slots = this.genererSlots(dto.heureDebut, dto.heureFin, dto.dureePrestation);

    if (slots.length === 0) {
      throw new BadRequestException('Plage horaire trop courte pour la durée sélectionnée');
    }

    const creneauxCrees = [];

    for (const date of dto.dates) {
      // Stocker aussi la plage parente pour l'affichage prestataire
      const plagePrestataireRef = this.firebase.collection('plages').doc();
      await plagePrestataireRef.set({
        id: plagePrestataireRef.id,
        prestataireId,
        heureDebut: dto.heureDebut,
        heureFin: dto.heureFin,
        dureePrestation: dto.dureePrestation,
        date,
        nbSlots: slots.length,
        createdAt: new Date(),
      });

      // Créer chaque slot individuellement
      for (const slot of slots) {
        const ref = this.firebase.collection('creneaux').doc();
        const creneau = {
          id: ref.id,
          plageId: plagePrestataireRef.id,
          prestataireId,
          heureDebut: slot.debut,
          heureFin: slot.fin,
          dureePrestation: dto.dureePrestation,
          plageDebut: dto.heureDebut,
          plageFin: dto.heureFin,
          date,
          statut: 'DISPONIBLE',
          createdAt: new Date(),
        };
        await ref.set(creneau);
        creneauxCrees.push(creneau);
      }
    }

    return {
      message: `${slots.length} slot(s) × ${dto.dates.length} date(s) = ${creneauxCrees.length} créneau(x) créé(s)`,
      slots: slots.length,
      creneaux: creneauxCrees,
    };
  }

  /**
   * Génère les slots à partir d'une plage horaire.
   */
  private genererSlots(heureDebut: string, heureFin: string, dureeMin: number) {
    const [hD, mD] = heureDebut.split(':').map(Number);
    const [hF, mF] = heureFin.split(':').map(Number);
    const debutMin = hD * 60 + mD;
    const finMin   = hF * 60 + mF;

    const slots = [];
    let cursor = debutMin;

    while (cursor + dureeMin <= finMin) {
      const debut = this.minutesToHeure(cursor);
      const fin   = this.minutesToHeure(cursor + dureeMin);
      slots.push({ debut, fin });
      cursor += dureeMin;
    }

    return slots;
  }

  private minutesToHeure(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /**
   * Pour le prestataire : retourne les plages (groupées) pas les slots individuels.
   */
  async getCreneauxPrestataire(prestataireId: string) {
    const snapshot = await this.firebase.collection('plages')
      .where('prestataireId', '==', prestataireId)
      .get();

    if (snapshot.empty) return [];

    return snapshot.docs
      .map(d => d.data())
      .sort((a, b) => {
        const [jA, mA, aA] = a.date.split('/').map(Number);
        const [jB, mB, aB] = b.date.split('/').map(Number);
        const dA = new Date(aA, mA-1, jA).getTime();
        const dB = new Date(aB, mB-1, jB).getTime();
        if (dA !== dB) return dA - dB;
        return a.heureDebut.localeCompare(b.heureDebut);
      });
  }

  /**
   * Pour le client : retourne les slots DISPONIBLES uniquement.
   */
  async getCreneauxDisponibles(prestataireId: string) {
    const snapshot = await this.firebase.collection('creneaux')
      .where('prestataireId', '==', prestataireId)
      .where('statut', '==', 'DISPONIBLE')
      .get();

    if (snapshot.empty) return [];

    const now = new Date();
    const heureActuelleMin = now.getHours() * 60 + now.getMinutes();

    return snapshot.docs
      .map(d => d.data())
      .filter(c => {
        if (!c.date || !c.heureDebut) return false;
        const [jour, mois, annee] = c.date.split('/').map(Number);
        const [hD, mD] = c.heureDebut.split(':').map(Number);
        const dateC = new Date(annee, mois-1, jour);
        const dateA = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (dateC < dateA) return false;
        if (dateC.getTime() === dateA.getTime()) {
          if (hD * 60 + mD <= heureActuelleMin) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const [jA, mA, aA] = a.date.split('/').map(Number);
        const [jB, mB, aB] = b.date.split('/').map(Number);
        const dA = new Date(aA, mA-1, jA).getTime();
        const dB = new Date(aB, mB-1, jB).getTime();
        if (dA !== dB) return dA - dB;
        return a.heureDebut.localeCompare(b.heureDebut);
      });
  }

  /**
   * Supprime une plage et tous ses slots.
   */
  async supprimerCreneau(plageId: string, prestataireId: string) {
    // Chercher d'abord dans les plages
    const plageDoc = await this.firebase.collection('plages').doc(plageId).get();

    if (plageDoc.exists) {
      const plage = plageDoc.data();
      if (plage.prestataireId !== prestataireId) throw new BadRequestException('Action non autorisée');

      // Supprimer tous les slots de cette plage
      const slotsSnap = await this.firebase.collection('creneaux')
        .where('plageId', '==', plageId).get();

      const batch = this.firebase.getFirestore().batch();
      slotsSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(plageDoc.ref);
      await batch.commit();

      return { message: `Plage et ${slotsSnap.size} slot(s) supprimés` };
    }

    // Fallback : supprimer un slot individuel
    const slotDoc = await this.firebase.collection('creneaux').doc(plageId).get();
    if (!slotDoc.exists) throw new NotFoundException('Créneau introuvable');
    const slot = slotDoc.data();
    if (slot.prestataireId !== prestataireId) throw new BadRequestException('Action non autorisée');
    await slotDoc.ref.delete();
    return { message: 'Slot supprimé' };
  }
}