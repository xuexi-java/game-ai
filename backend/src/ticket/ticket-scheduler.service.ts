import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TicketService } from './ticket.service';

@Injectable()
export class TicketSchedulerService {
  private readonly logger = new Logger(TicketSchedulerService.name);

  constructor(private ticketService: TicketService) {}

  /**
   * 每天执行一次定时任务
   * 检查超过3天没有继续处理的工单
   * 如果工单3天玩家还是没有继续处理，就默认结束并修改状态为 RESOLVED
   * Cron 表达式：每天凌晨2点执行
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'checkStaleTickets',
    timeZone: 'Asia/Shanghai',
  })
  async handleStaleTicketsCheck() {
    this.logger.log('开始执行定时任务：检查超过3天未处理的工单');
    try {
      await this.ticketService.checkStaleTickets();
      this.logger.log('定时任务执行完成：检查超过3天未处理的工单');
    } catch (error) {
      this.logger.error(`定时任务执行失败: ${error.message}`, error.stack);
    }
  }
}
