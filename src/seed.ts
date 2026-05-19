/**
 * SCRIPT DE SEED — MonTour
 * Lance avec : npx ts-node src/seed.ts
 * ⚠️  L'admin existant (admin@montour.sn) est préservé — pas touché.
 */
import * as admin from 'firebase-admin';
import * as bcrypt from 'bcryptjs';
import * as serviceAccount from '../serviceAccountKey.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const db = admin.firestore();

async function seed() {
  console.log('🌱 Démarrage du seed MonTour...');
  console.log('⚠️  Admin existant préservé (admin@montour.sn)\n');

  const password = await bcrypt.hash('Montour2026!', 10);

  // ── 1. ENTREPRISES ───────────────────────────────────────────────────
  console.log('📦 Création des entreprises...');

  const entreprises = [
    {
      id: 'entreprise-clinique-001',
      nom: 'Clinique Pasteur Dakar',
      codeHex: 'CLIN2026',
      statut: 'VALIDEE',
      specialites: ['Cardiologie', 'Ophtalmologie', 'Médecine générale'],
      adresse: 'Avenue Pasteur, Dakar',
      telephone: '+221 33 821 00 00',
      categorie: 'Santé',
      createdAt: new Date(),
    },
    {
      id: 'entreprise-garage-001',
      nom: 'Garage Auto Dakar',
      codeHex: 'GARA2026',
      statut: 'VALIDEE',
      specialites: ['Vidange', 'Révision', 'Climatisation'],
      adresse: 'Route de Rufisque, Dakar',
      telephone: '+221 77 500 00 00',
      categorie: 'Automobile',
      createdAt: new Date(),
    },
    {
      id: 'entreprise-mairie-001',
      nom: 'Mairie de Dakar',
      codeHex: 'MAIR2026',
      statut: 'VALIDEE',
      specialites: ['État civil', 'Urbanisme', 'Services administratifs'],
      adresse: 'Place de l\'Indépendance, Dakar',
      telephone: '+221 33 823 00 00',
      categorie: 'Administratif',
      createdAt: new Date(),
    },
  ];

  for (const e of entreprises) {
    await db.collection('entreprises').doc(e.id).set(e, { merge: true });
    console.log(`  ✅ ${e.nom} (code: ${e.codeHex})`);
  }

  // ── 2. PRESTATAIRES ──────────────────────────────────────────────────
  console.log('\n👤 Création des prestataires...');

  const prestataires = [
    {
      id: 'user-prest-cardio',
      nom: 'Ndiaye', prenom: 'Ousmane',
      email: 'dr.ndiaye@montour.sn',
      password,
      telephone: '+221 77 111 11 11',
      role: 'PRESTATAIRE',
      isVerified: true,
      acceptedCGU: true,
      entrepriseId: 'entreprise-clinique-001',
      specialite: 'Cardiologie',
      confirmationMode: 'manual',
      createdAt: new Date(), updatedAt: new Date(),
    },
    {
      id: 'user-prest-ophta',
      nom: 'Fall', prenom: 'Aminata',
      email: 'dr.fall@montour.sn',
      password,
      telephone: '+221 77 222 22 22',
      role: 'PRESTATAIRE',
      isVerified: true,
      acceptedCGU: true,
      entrepriseId: 'entreprise-clinique-001',
      specialite: 'Ophtalmologie',
      confirmationMode: 'auto',
      createdAt: new Date(), updatedAt: new Date(),
    },
    {
      id: 'user-prest-garage',
      nom: 'Diallo', prenom: 'Ibrahima',
      email: 'garage@montour.sn',
      password,
      telephone: '+221 77 333 33 33',
      role: 'PRESTATAIRE',
      isVerified: true,
      acceptedCGU: true,
      entrepriseId: 'entreprise-garage-001',
      specialite: 'Vidange',
      confirmationMode: 'auto',
      createdAt: new Date(), updatedAt: new Date(),
    },
    {
      id: 'user-prest-mairie',
      nom: 'Sarr', prenom: 'Fatou',
      email: 'mairie@montour.sn',
      password,
      telephone: '+221 77 444 44 44',
      role: 'PRESTATAIRE',
      isVerified: true,
      acceptedCGU: true,
      entrepriseId: 'entreprise-mairie-001',
      specialite: 'État civil',
      confirmationMode: 'manual',
      createdAt: new Date(), updatedAt: new Date(),
    },
  ];

  for (const p of prestataires) {
    // Vérifier si l'email existe déjà pour ne pas écraser
    const existing = await db.collection('users').where('email', '==', p.email).get();
    if (!existing.empty) {
      console.log(`  ⏭️  ${p.prenom} ${p.nom} existe déjà — ignoré`);
      continue;
    }
    await db.collection('users').doc(p.id).set(p);
    console.log(`  ✅ ${p.prenom} ${p.nom} — ${p.email}`);
  }

  // ── 3. CLIENTS ───────────────────────────────────────────────────────
  console.log('\n🙋 Création des clients...');

  const clients = [
    {
      id: 'user-client-001',
      nom: 'Ba', prenom: 'Mariama',
      email: 'mariama@montour.sn',
      password,
      telephone: '+221 77 555 55 55',
      role: 'CLIENT',
      isVerified: true,
      acceptedCGU: true,
      createdAt: new Date(), updatedAt: new Date(),
    },
    {
      id: 'user-client-002',
      nom: 'Sow', prenom: 'Moussa',
      email: 'moussa@montour.sn',
      password,
      telephone: '+221 77 666 66 66',
      role: 'CLIENT',
      isVerified: true,
      acceptedCGU: true,
      createdAt: new Date(), updatedAt: new Date(),
    },
  ];

  for (const c of clients) {
    const existing = await db.collection('users').where('email', '==', c.email).get();
    if (!existing.empty) {
      console.log(`  ⏭️  ${c.prenom} ${c.nom} existe déjà — ignoré`);
      continue;
    }
    await db.collection('users').doc(c.id).set(c);
    console.log(`  ✅ ${c.prenom} ${c.nom} — ${c.email}`);
  }

  // ── 4. CRÉNEAUX (7 prochains jours) ─────────────────────────────────
  console.log('\n🗓️  Création des créneaux...');

  // Supprimer les anciens créneaux DISPONIBLES pour repartir propre
  const oldCreneaux = await db.collection('creneaux').where('statut', '==', 'DISPONIBLE').get();
  if (!oldCreneaux.empty) {
    const batch = db.batch();
    oldCreneaux.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`  🗑️  ${oldCreneaux.size} anciens créneaux supprimés`);
  }

  const plannings = [
    { id: 'user-prest-cardio', heures: ['08:00','09:00','10:00','11:00','14:00','15:00','16:00'] },
    { id: 'user-prest-ophta',  heures: ['08:30','09:30','10:30','11:30','14:30','15:30'] },
    { id: 'user-prest-garage', heures: ['08:00','09:00','10:00','11:00','14:00','15:00','16:00','17:00'] },
    { id: 'user-prest-mairie', heures: ['08:00','09:00','10:00','11:00','14:00','15:00'] },
  ];

  const today = new Date();
  let count = 0;

  for (const p of plannings) {
    for (let j = 0; j < 7; j++) {
      const date = new Date(today);
      date.setDate(today.getDate() + j);
      if (date.getDay() === 0) continue; // pas le dimanche

      const dateStr = `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;

      for (const heure of p.heures) {
        const [h] = heure.split(':').map(Number);
        const heureFin = `${String(h + 1).padStart(2,'0')}:00`;
        const ref = db.collection('creneaux').doc();
        await ref.set({
          id: ref.id,
          prestataireId: p.id,
          heureDebut: heure,
          heureFin,
          dureePrestation: 30,
          date: dateStr,
          statut: 'DISPONIBLE',
          createdAt: new Date(),
        });
        count++;
      }
    }
  }
  console.log(`  ✅ ${count} créneaux créés`);

  // ── RÉSUMÉ ────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════');
  console.log('✅ Seed terminé !');
  console.log('════════════════════════════════════════════════');
  console.log('\n📋 Comptes (mot de passe : Montour2026!) :');
  console.log('  ADMIN (existant) → admin@montour.sn       (votre mot de passe habituel)');
  console.log('  PRESTATAIRE      → dr.ndiaye@montour.sn   Montour2026!');
  console.log('  PRESTATAIRE      → dr.fall@montour.sn     Montour2026!');
  console.log('  PRESTATAIRE      → garage@montour.sn      Montour2026!');
  console.log('  PRESTATAIRE      → mairie@montour.sn      Montour2026!');
  console.log('  CLIENT           → mariama@montour.sn     Montour2026!');
  console.log('  CLIENT           → moussa@montour.sn      Montour2026!');
  console.log('\n🔑 Codes entreprise pour inscription :');
  console.log('  Clinique Pasteur → CLIN2026');
  console.log('  Garage Auto      → GARA2026');
  console.log('  Mairie de Dakar  → MAIR2026');
  console.log('════════════════════════════════════════════════\n');

  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
