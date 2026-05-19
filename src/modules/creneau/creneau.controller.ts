import { Controller, Post, Body, Get, Param, Delete, UseGuards } from '@nestjs/common';
import { CreneauService } from './creneau.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('creneaux')
@UseGuards(FirebaseAuthGuard)
export class CreneauController {
  constructor(private readonly creneauService: CreneauService) {}

  @Post()
  creer(@CurrentUser() user: any, @Body() dto: any) {
    return this.creneauService.creerCreneau(user.sub, dto);
  }

  @Get('prestataire')
  getMesCreneaux(@CurrentUser() user: any) {
    return this.creneauService.getCreneauxPrestataire(user.sub);
  }

  @Get(':prestataireId/disponibles')
  getDisponibles(@Param('prestataireId') prestataireId: string) {
    return this.creneauService.getCreneauxDisponibles(prestataireId);
  }

  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: any) {
    return this.creneauService.supprimerCreneau(id, user.sub);
  }
}