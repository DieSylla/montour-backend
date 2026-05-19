/**
 * SCRIPT DE SEED — MonTour (version allégée pour démo)
 * node seed.js
 */
const admin  = require('firebase-admin');
const bcrypt = require('bcryptjs');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function genererSlots(heureDebut, heureFin, dureeMin) {
  const [hD, mD] = heureDebut.split(':').map(Number);
  const [hF, mF] = heureFin.split(':').map(Number);
  let cursor = hD * 60 + mD;
  const finMin = hF * 60 + mF;
  const slots = [];
  while (cursor + dureeMin <= finMin) {
    const h1 = String(Math.floor(cursor/60)).padStart(2,'0');
    const m1 = String(cursor%60).padStart(2,'0');
    cursor += dureeMin;
    const h2 = String(Math.floor(cursor/60)).padStart(2,'0');
    const m2 = String(cursor%60).padStart(2,'0');
    slots.push({ debut: `${h1}:${m1}`, fin: `${h2}:${m2}` });
  }
  return slots;
}

async function viderCollection(nom, exceptEmail = null) {
  const snap = await db.collection(nom).get();
  if (snap.empty) return 0;
  let count = 0;
  const batch = db.batch();
  for (const doc of snap.docs) {
    if (exceptEmail && doc.data().email === exceptEmail) continue;
    batch.delete(doc.ref);
    count++;
  }
  await batch.commit();
  return count;
}

async function seed() {
  console.log('🌱 Seed MonTour — Version démo...\n');
  const password = await bcrypt.hash('Montour2026!', 10);

  // ── NETTOYAGE ────────────────────────────────────────
  console.log('🗑️  Nettoyage...');
  await viderCollection('users', 'admin@montour.sn');
  await viderCollection('creneaux');
  await viderCollection('plages');
  await viderCollection('tickets');
  await viderCollection('reservations');
  await viderCollection('notifications');
  console.log('  ✅ Base nettoyée (admin préservé)');

  // ── ENTREPRISES ──────────────────────────────────────
  console.log('\n📦 Entreprises...');
  await db.collection('entreprises').doc('entreprise-clinique-001').set({
    id:'entreprise-clinique-001', nom:'Clinique Pasteur Dakar',
    codeHex:'CLIN2026', statut:'VALIDEE',
    specialites:['Cardiologie','Ophtalmologie','Médecine générale'],
    adresse:'Avenue Pasteur, Dakar', categorie:'Santé', createdAt: new Date()
  }, { merge:true });

  await db.collection('entreprises').doc('entreprise-garage-001').set({
    id:'entreprise-garage-001', nom:'Garage Auto Dakar',
    codeHex:'GARA2026', statut:'VALIDEE',
    specialites:['Vidange','Révision'],
    adresse:'Route de Rufisque, Dakar', categorie:'Automobile', createdAt: new Date()
  }, { merge:true });

  await db.collection('entreprises').doc('entreprise-mairie-001').set({
    id:'entreprise-mairie-001', nom:'Mairie de Dakar',
    codeHex:'MAIR2026', statut:'VALIDEE',
    specialites:['État civil','Urbanisme'],
    adresse:"Place de l'Indépendance, Dakar", categorie:'Administratif', createdAt: new Date()
  }, { merge:true });
  console.log('  ✅ 3 entreprises');

  // ── USERS ────────────────────────────────────────────
  console.log('\n👥 Utilisateurs...');
  const users = [
    { id:'user-prest-cardio', nom:'Ndiaye', prenom:'Ousmane', email:'dr.ndiaye@montour.sn', password, telephone:'+221771111111', role:'PRESTATAIRE', isVerified:true, acceptedCGU:true, entrepriseId:'entreprise-clinique-001', specialite:'Cardiologie', confirmationMode:'manual', createdAt:new Date(), updatedAt:new Date() },
    { id:'user-prest-garage', nom:'Diallo', prenom:'Ibrahima', email:'garage@montour.sn', password, telephone:'+221773333333', role:'PRESTATAIRE', isVerified:true, acceptedCGU:true, entrepriseId:'entreprise-garage-001', specialite:'Vidange', confirmationMode:'auto', createdAt:new Date(), updatedAt:new Date() },
    { id:'user-prest-mairie', nom:'Sarr', prenom:'Fatou', email:'mairie@montour.sn', password, telephone:'+221774444444', role:'PRESTATAIRE', isVerified:true, acceptedCGU:true, entrepriseId:'entreprise-mairie-001', specialite:'État civil', confirmationMode:'manual', createdAt:new Date(), updatedAt:new Date() },
    { id:'user-client-001', nom:'Ba', prenom:'Mariama', email:'mariama@montour.sn', password, telephone:'+221775555555', role:'CLIENT', isVerified:true, acceptedCGU:true, createdAt:new Date(), updatedAt:new Date() },
    { id:'user-client-002', nom:'Sow', prenom:'Moussa', email:'moussa@montour.sn', password, telephone:'+221776666666', role:'CLIENT', isVerified:true, acceptedCGU:true, createdAt:new Date(), updatedAt:new Date() },
  ];
  for (const u of users) {
    await db.collection('users').doc(u.id).set(u);
    console.log(`  ✅ [${u.role}] ${u.prenom} ${u.nom}`);
  }

  // ── PLAGES + SLOTS (3 jours seulement) ───────────────
  console.log('\n🗓️  Plages et slots (3 jours)...');

  // Une seule plage matin par prestataire, 3 prochains jours ouvrés
  const plannings = [
    { id:'user-prest-cardio', debut:'08:00', fin:'11:00', duree:30 },
    { id:'user-prest-garage', debut:'08:00', fin:'11:00', duree:45 },
    { id:'user-prest-mairie', debut:'08:00', fin:'11:00', duree:30 },
  ];

  const today = new Date();
  let totalSlots = 0;
  let joursAjoutes = 0;
  let j = 0;

  while (joursAjoutes < 3) {
    const date = new Date(today);
    date.setDate(today.getDate() + j);
    j++;
    if (date.getDay() === 0 || date.getDay() === 6) continue; // pas weekend
    const dateStr = `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;

    for (const p of plannings) {
      const slots = genererSlots(p.debut, p.fin, p.duree);
      const plageRef = db.collection('plages').doc();
      await plageRef.set({
        id: plageRef.id,
        prestataireId: p.id,
        heureDebut: p.debut,
        heureFin: p.fin,
        dureePrestation: p.duree,
        date: dateStr,
        nbSlots: slots.length,
        createdAt: new Date(),
      });
      for (const slot of slots) {
        const ref = db.collection('creneaux').doc();
        await ref.set({
          id: ref.id,
          plageId: plageRef.id,
          prestataireId: p.id,
          heureDebut: slot.debut,
          heureFin: slot.fin,
          dureePrestation: p.duree,
          plageDebut: p.debut,
          plageFin: p.fin,
          date: dateStr,
          statut: 'DISPONIBLE',
          createdAt: new Date(),
        });
        totalSlots++;
      }
    }
    joursAjoutes++;
  }

  console.log(`  ✅ ${totalSlots} slots sur 3 jours`);

  console.log('\n════════════════════════════════════════');
  console.log('✅ Seed terminé — Base propre !');
  console.log('════════════════════════════════════════');
  console.log('  ADMIN        → admin@montour.sn         (votre mot de passe)');
  console.log('  PRESTATAIRE  → dr.ndiaye@montour.sn     Montour2026!');
  console.log('  PRESTATAIRE  → garage@montour.sn        Montour2026!');
  console.log('  PRESTATAIRE  → mairie@montour.sn        Montour2026!');
  console.log('  CLIENT       → mariama@montour.sn       Montour2026!');
  console.log('  CLIENT       → moussa@montour.sn        Montour2026!');
  console.log('════════════════════════════════════════\n');
  process.exit(0);
}

seed().catch(err => { console.error('❌', err); process.exit(1); });