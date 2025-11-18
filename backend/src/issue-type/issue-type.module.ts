import { Module } from '@nestjs/common';
import { IssueTypeController } from './issue-type.controller';
import { IssueTypeService } from './issue-type.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [IssueTypeController],
  providers: [IssueTypeService, PrismaService],
  exports: [IssueTypeService],
})
export class IssueTypeModule {}
