import { Controller, Post, Body, Patch, Param, Get, Delete, UseGuards } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('reservations')
@UseGuards(FirebaseAuthGuard)
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  @Get('mes-reservations')
  getMesReservations(@CurrentUser() user: any) {
    return this.reservationService.getMesReservations(user.sub);
  }

  @Get('prestataire')
  getReservationsPrestataire(@CurrentUser() user: any) {
    return this.reservationService.getReservationsPrestataire(user.sub);
  }

  @Get('creneau/:creneauId')
  getReservationsCreneau(@Param('creneauId') creneauId: string, @CurrentUser() user: any) {
    return this.reservationService.getReservationsCreneau(creneauId, user.sub);
  }

  @Post()
  async creer(@CurrentUser() user: any, @Body() dto: any) {
    const result = await this.reservationService.creerReservation(user.sub, dto);
    // Envoyer notifications après création (non bloquant)
    this.reservationService.notifierApresReservation(result.reservationId).catch(() => {});
    return result;
  }

  @Patch(':id/annuler')
  async annuler(@Param('id') id: string, @CurrentUser() user: any) {
    const result = await this.reservationService.annulerReservation(id, user.sub);
    this.reservationService.notifierAnnulation(id).catch(() => {});
    return result;
  }

  @Patch(':id/valider')
  valider(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reservationService.repondreReservation(id, user.sub, 'valider');
  }

  @Patch(':id/refuser')
  refuser(@Param('id') id: string, @CurrentUser() user: any, @Body('motif') motif: string) {
    return this.reservationService.repondreReservation(id, user.sub, 'refuser', motif);
  }

  @Patch(':id/absent')
  marquerAbsent(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reservationService.marquerAbsent(id, user.sub);
  }

  @Delete(':id')
  supprimer(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reservationService.supprimerReservation(id, user.sub);
  }
}
