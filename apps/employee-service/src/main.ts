import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AllExceptionsFilter } from '@dexa-wfh/common';
import { loadEnvConfig } from '@dexa-wfh/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const config = loadEnvConfig();
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(config.EMPLOYEE_SERVICE_PORT, '0.0.0.0');
  console.log(`Employee Service running on http://localhost:${config.EMPLOYEE_SERVICE_PORT}`);
}

bootstrap();
