import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { IssueTypeService } from './issue-type.service';
import { CreateIssueTypeDto } from './dto/create-issue-type.dto';
import { UpdateIssueTypeDto } from './dto/update-issue-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('issue-types')
export class IssueTypeController {
  constructor(private readonly issueTypeService: IssueTypeService) {}

  // 获取启用的问题类型（公开接口，玩家端使用）
  @Get()
  findEnabled() {
    return this.issueTypeService.findEnabled();
  }

  // 获取所有问题类型（管理端）
  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.issueTypeService.findAll();
  }

  // 获取单个问题类型
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.issueTypeService.findOne(id);
  }

  // 创建问题类型
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() createDto: CreateIssueTypeDto) {
    return this.issueTypeService.create(createDto);
  }

  // 更新问题类型
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() updateDto: UpdateIssueTypeDto) {
    return this.issueTypeService.update(id, updateDto);
  }

  // 切换启用状态
  @Patch(':id/toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  toggle(@Param('id') id: string) {
    return this.issueTypeService.toggle(id);
  }

  // 删除问题类型
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.issueTypeService.remove(id);
  }
}
