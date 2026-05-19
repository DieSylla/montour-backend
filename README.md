# MonTour — Backend API

Application de gestion de files d'attente et rendez-vous digitaux.

## Stack technique
- **Framework** : NestJS (Node.js)
- **Base de données** : Firebase Firestore
- **Authentification** : Firebase Auth
- **Notifications push** : Firebase Cloud Messaging (FCM)
- **Temps réel** : WebSocket (Socket.io)
- **Géolocalisation** : API Haversine + Google Maps

## Installation

```bash
# Cloner le projet
git clone https://github.com/TON-USERNAME/montour-backend.git
cd montour-backend

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Remplir .env avec vos clés Firebase

# Lancer en développement
npm run start:dev
```

## Structure du projet

```
src/
├── modules/
│   ├── auth/          → Inscription, OTP, connexion
│   ├── user/          → Profil utilisateur
│   ├── entreprise/    → Adhésion et validation entreprise
│   ├── ticket/        → Gestion des tickets virtuels
│   ├── reservation/   → Réservation de créneaux
│   ├── file-attente/  → Logique de file et recalcul
│   ├── notification/  → FCM et historique notifs
│   └── admin/         → Back-office administrateur
├── common/
│   ├── guards/        → Firebase Auth Guard
│   ├── decorators/    → @CurrentUser
│   └── filters/       → Gestion erreurs globale
└── firebase/          → Module Firebase (Firestore, Auth, FCM)
```

## Endpoints principaux

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | /api/v1/auth/register | Inscription client ou prestataire |
| POST | /api/v1/auth/verify-otp | Vérification OTP |
| GET | /api/v1/entreprises/code/:hex/specialites | Spécialités par code hex |
| POST | /api/v1/entreprises/adhesion | Demande d'adhésion entreprise |
| POST | /api/v1/tickets | Prendre un ticket virtuel |
| PATCH | /api/v1/tickets/:id/annuler | Annuler un ticket |
| POST | /api/v1/reservations | Réserver un créneau |
| PATCH | /api/v1/reservations/:id/valider | Valider une réservation (prestataire) |
| GET | /api/v1/notifications | Mes notifications |
| GET | /api/v1/admin/stats | Stats globales (admin) |

## Architecture

Ce projet suit la **Clean Architecture** :
- **Présentation** : Controllers + DTOs
- **Application** : Services + Use Cases
- **Domaine** : Entités + Interfaces
- **Infrastructure** : Firebase (Firestore, Auth, FCM)

Projet réalisé dans le cadre d'un mémoire de Master 2 Génie Logiciel.
