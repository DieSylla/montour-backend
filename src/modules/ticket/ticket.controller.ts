import { Controller, Post, Body, Patch, Param, Get, UseGuards } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('tickets')
@UseGuards(FirebaseAuthGuard)
export class TicketController {
  constructor(private readonly ticketService: TicketService) {}

  // ── Routes GET spécifiques EN PREMIER (avant les paramètres) ──
  @Get('actif')
  getTicketActif(@CurrentUser() user: any) {
    return this.ticketService.getTicketActif(user.sub);
  }

  @Get('prestataire')
  getTicketsPrestataire(@CurrentUser() user: any) {
    return this.ticketService.getTicketsPrestataire(user.sub);
  }

  // ── Routes POST / PATCH ──
  @Post()
  creerTicket(@CurrentUser() user: any, @Body() dto: CreateTicketDto) {
    return this.ticketService.creerTicket(user.sub, dto);
  }

  @Patch(':id/appeler')
  appelerTicket(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ticketService.appelerTicket(id, user.sub);
  }

  @Patch(':id/terminer')
  terminerTicket(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ticketService.terminerTicket(id, user.sub);
  }

  @Patch(':id/annuler')
  annulerTicket(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ticketService.annulerTicket(id, user.sub);
  }
  @Get('file/:prestataireId')
getFile(@Param('prestataireId') prestataireId: string) {
  return this.ticketService.getNbPersonnesFile(prestataireId);
}
}
