import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FirebaseService } from '../../firebase/firebase.service';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from '../user/entities/user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.acceptedCGU) {
      throw new BadRequestException('Vous devez accepter les CGU');
    }
    const existing = await this.firebase.collection('users')
      .where('email', '==', dto.email).get();
    if (!existing.empty) {
      throw new BadRequestException('Cet email est déjà utilisé');
    }
    if (dto.role === UserRole.PRESTATAIRE) {
      if (!dto.codeEntreprise || !dto.specialite) {
        throw new BadRequestException('Code entreprise et spécialité requis');
      }
      await this.verifierCodeEntreprise(dto.codeEntreprise, dto.specialite);
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    const userRef = this.firebase.collection('users').doc();
    const userId = userRef.id;
    await userRef.set({
      id: userId, nom: dto.nom, prenom: dto.prenom,
      email: dto.email, password: hashedPassword,
      telephone: dto.telephone, role: dto.role,
      isVerified: false, acceptedCGU: true,
      otp, otpExpires, createdAt: new Date(), updatedAt: new Date(),
    });
    console.log(`OTP pour ${dto.email}: ${otp}`);
    return { message: 'Inscription réussie.', userId, otp };
  }

  async login(email: string, password: string) {
    try {
      console.log('LOGIN tentative pour:', email);
      const snapshot = await this.firebase.collection('users')
        .where('email', '==', email).get();
      console.log('Users trouvés:', snapshot.size);
      if (snapshot.empty) throw new UnauthorizedException('Email ou mot de passe incorrect');

      const user = snapshot.docs[0].data();
      console.log('User:', user.email, 'role:', user.role);

      const isValid = await bcrypt.compare(password, user.password);
      console.log('Password valide:', isValid);
      if (!isValid) throw new UnauthorizedException('Email ou mot de passe incorrect');
      if (!user.isVerified) throw new UnauthorizedException('Veuillez vérifier votre compte');

      const token = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
      console.log('Token OK');

      let entrepriseNom = null;
      try {
        if (user.entrepriseId) {
          const doc = await this.firebase.collection('entreprises').doc(user.entrepriseId).get();
          entrepriseNom = doc.exists ? doc.data()?.nom || null : null;
          console.log('Entreprise:', entrepriseNom);
        }
      } catch (e) {
console.warn('Entreprise non trouvée:', (e as any).message);      }

      return {
        access_token: token,
        user: {
          id: user.id, nom: user.nom, prenom: user.prenom,
          email: user.email, role: user.role,
          specialite: user.specialite || null,
          entrepriseId: user.entrepriseId || null,
          entrepriseNom,
          telephone: user.telephone || null,
          confirmationMode: user.confirmationMode || null,
        },
      };
    } catch (error) {
console.error('ERREUR LOGIN:', (error as any).message);      throw error;
    }
  }

  async verifyOtp(userId: string, otp: string) {
    const userDoc = await this.firebase.collection('users').doc(userId).get();
    if (!userDoc.exists) throw new BadRequestException('Utilisateur introuvable');
    const user = userDoc.data();
    if (user.otp !== otp) throw new BadRequestException('Code OTP incorrect');
    if (new Date() > user.otpExpires.toDate()) throw new BadRequestException('OTP expiré');
    await this.firebase.collection('users').doc(userId).update({
      isVerified: true, otp: null, otpExpires: null, updatedAt: new Date(),
    });
    return { message: 'Compte vérifié avec succès.' };
  }

  private async verifierCodeEntreprise(codeHex: string, specialite: string) {
    const snapshot = await this.firebase.collection('entreprises')
      .where('codeHex', '==', codeHex)
      .where('statut', '==', 'VALIDEE').get();
    if (snapshot.empty) throw new BadRequestException('Code entreprise invalide');
    const entreprise = snapshot.docs[0].data();
    if (!entreprise.specialites.includes(specialite)) {
      throw new BadRequestException(`Spécialité "${specialite}" introuvable`);
    }
    return entreprise;
  }
}