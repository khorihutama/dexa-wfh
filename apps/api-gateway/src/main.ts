import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from '@dexa-wfh/common';
import { loadEnvConfig } from '@dexa-wfh/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const config = loadEnvConfig();
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: config.CORS_ORIGIN,
  });
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Dexa WFH API Gateway')
    .setDescription('Public REST Gateway & Microservices Proxy for Dexa WFH Attendance System')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(config.API_GATEWAY_PORT, '0.0.0.0');
  console.log(`API Gateway running on http://localhost:${config.API_GATEWAY_PORT} (Swagger: /docs)`);
}

bootstrap();
