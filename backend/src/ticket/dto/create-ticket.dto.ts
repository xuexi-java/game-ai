import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsArray,
} from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @IsString()
  @IsOptional()
  serverId?: string;

  @IsString()
  @IsOptional()
  serverName?: string;

  @IsString()
  @IsNotEmpty()
  playerIdOrName: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsDateString()
  @IsOptional()
  occurredAt?: string;

  @IsString()
  @IsOptional()
  paymentOrderNo?: string;

  // 新增：问题类型 IDs
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  issueTypeIds: string[];
}

export class TicketResponseDto {
  id: string;
  ticketNo: string;
  token: string;
}
