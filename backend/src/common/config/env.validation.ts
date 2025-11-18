import { plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsNotEmpty()
  @IsString()
  DATABASE_URL: string;

  @IsNotEmpty()
  @IsString()
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  @IsOptional()
  @IsNumber()
  PORT?: number;

  @IsOptional()
  @IsString()
  NODE_ENV?: string;

  @IsOptional()
  @IsString()
  FRONTEND_URL?: string;

  @IsOptional()
  @IsString()
  REDIS_URL?: string;

  @IsOptional()
  @IsString()
  UPLOAD_DIR?: string;

  @IsOptional()
  @IsNumber()
  MAX_FILE_SIZE?: number;

  @IsOptional()
  @IsString()
  OSS_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  OSS_ACCESS_KEY_SECRET?: string;

  @IsOptional()
  @IsString()
  OSS_BUCKET?: string;

  @IsOptional()
  @IsString()
  OSS_REGION?: string;

  @IsOptional()
  @IsString()
  OSS_ENDPOINT?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `环境变量验证失败:\n${errors
        .map(
          (e) =>
            `- ${e.property}: ${Object.values(e.constraints || {}).join(', ')}`,
        )
        .join('\n')}`,
    );
  }

  return validatedConfig;
}
