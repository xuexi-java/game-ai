import { Module } from '@nestjs/common';
import { DifyService } from './dify.service';
import { DifyController } from './dify.controller';
import { GameModule } from '../game/game.module';
import { EncryptionModule } from '../common/encryption/encryption.module';

@Module({
  imports: [GameModule, EncryptionModule],
  controllers: [DifyController],
  providers: [DifyService],
  exports: [DifyService],
})
export class DifyModule {}
