import { Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { TicketPriorityService } from './ticket-priority.service';
import { PrismaService } from '../prisma/prisma.service';
import { IssueTypeModule } from '../issue-type/issue-type.module';

@Module({
  imports: [IssueTypeModule],
  controllers: [TicketController],
  providers: [TicketService, TicketPriorityService, PrismaService],
  exports: [TicketService],
})
export class TicketModule {}
