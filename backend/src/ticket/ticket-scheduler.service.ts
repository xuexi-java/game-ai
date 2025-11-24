import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TicketService } from './ticket.service';

@Injectable()
export class TicketSchedulerService {
  private readonly logger = new Logger(TicketSchedulerService.name);

  constructor(private ticketService: TicketService) {}

  /**
   * 每3天执行一次定时任务
   * 检查超过3天没有更新状态的工单
   * Cron 表达式：每3天的凌晨2点执行
   * 表达式格式：0 2 * /3 * * (每3天的凌晨2点)
   * 注意：为了测试方便，也可以使用 CronExpression.EVERY_DAY_AT_2AM 每天执行
   */
  @Cron('0 2 */3 * *', {
    name: 'checkStaleTickets',
    timeZone: 'Asia/Shanghai',
  })
  async handleStaleTicketsCheck() {
    this.logger.log('开始执行定时任务：检查超过3天的工单状态');
    try {
      await this.ticketService.checkStaleTickets();
      this.logger.log('定时任务执行完成：检查超过3天的工单状态');
    } catch (error) {
      this.logger.error(`定时任务执行失败: ${error.message}`, error.stack);
    }
  }
}

