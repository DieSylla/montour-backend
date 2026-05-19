import { IsEmail, IsString, IsEnum, IsBoolean, MinLength, IsNotEmpty, IsOptional } from 'class-validator';
import { UserRole } from '../../user/entities/user.entity';

export class RegisterDto {
  @IsString() @IsNotEmpty()
  nom: string;

  @IsString() @IsNotEmpty()
  prenom: string;

  @IsEmail()
  email: string;

  @IsString() @MinLength(8)
  password: string;

  @IsString() @IsNotEmpty()
  telephone: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsBoolean()
  acceptedCGU: boolean;

  @IsOptional() @IsString()
  codeEntreprise?: string;

  @IsOptional() @IsString()
  specialite?: string;
}