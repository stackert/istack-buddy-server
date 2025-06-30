import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // DEV/DEBUG: Enable CORS for any origin (not for production!)
  app.enableCors({
    origin: true, // Allow any origin
    credentials: true, // Allow cookies/credentials
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
  });

  // Enable cookie parsing
  app.use(cookieParser());

  // Swagger/OpenAPI configuration
  const config = new DocumentBuilder()
    .setTitle('iStack Buddy Server API')
    .setDescription(
      'Authentication and user management API for iStack Buddy platform',
    )
    .setVersion('1.0')
    .addTag('authentication', 'User authentication and session management')
    .addTag('profile', 'User profile management')
    .addCookieAuth('auth-token', {
      type: 'http',
      in: 'cookie',
      scheme: 'bearer',
      description: 'Authentication token stored in httpOnly cookie',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}

// Only run bootstrap if this file is executed directly (not imported)
if (require.main === module) {
  bootstrap();
}
