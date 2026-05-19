/**
 * Script de nettoyage des entreprises en double
 * node clean_entreprises.js
 */
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function clean() {
  console.log('🧹 Nettoyage des entreprises en double...\n');

  const snap = await db.collection('entreprises').get();
  console.log(`Total entreprises trouvées : ${snap.size}`);

  // Garder seulement les IDs fixes du seed
  const idsAGarder = [
    'entreprise-clinique-001',
    'entreprise-garage-001',
    'entreprise-mairie-001'
  ];

  const batch = db.batch();
  let count = 0;

  snap.docs.forEach(doc => {
    if (!idsAGarder.includes(doc.id)) {
      console.log(`  🗑️  Suppression : ${doc.id} (${doc.data().nom})`);
      batch.delete(doc.ref);
      count++;
    } else {
      console.log(`  ✅ Gardé : ${doc.id} (${doc.data().nom})`);
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(`\n✅ ${count} doublon(s) supprimé(s)`);
  } else {
    console.log('\n✅ Aucun doublon trouvé');
  }

  process.exit(0);
}

clean().catch(err => { console.error('❌', err); process.exit(1); });