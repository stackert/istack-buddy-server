import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
bootstrap();
