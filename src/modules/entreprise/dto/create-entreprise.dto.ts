import { IsString, IsArray, IsEmail, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateEntrepriseDto {
  @IsString() @IsNotEmpty()
  nom: string;

  @IsString() @IsNotEmpty()
  nomResponsable: string;

  @IsString() @IsNotEmpty()
  typeService: string;

  @IsArray()
  specialites: string[];

  @IsString() @IsNotEmpty()
  ninea: string;

  @IsString() @IsNotEmpty()
  adresse: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsEmail()
  email: string;

  @IsString() @IsNotEmpty()
  telephone: string;
}
