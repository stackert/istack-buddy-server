import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import { json } from 'express';

// Load environment variables from .env.live file (real keys for development/production)
dotenv.config({ path: '.env.live' });

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configure raw body parsing for Slack webhooks
  app.use(
    '/istack-buddy/slack-integration/slack/events',
    json({
      verify: (req: any, res, buf) => {
        // Store raw body for Slack signature verification and logging
        req.rawBody = buf;
        req.rawBodyString = buf.toString();
      },
    }),
  );

  // CORS configuration for client communication - TEMPORARY: Allow all origins
  app.enableCors({
    origin: true, // Allow all origins (equivalent to '*' but works with credentials)
    credentials: true, // Allow cookies/credentials
    methods: '*', // Allow all HTTP methods
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'Accept-Language',
      'Content-Language',
      'Cookie',
    ],
    exposedHeaders: ['Set-Cookie', 'Authorization'],
    optionsSuccessStatus: 200, // For legacy browser support
    preflightContinue: false,
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
    .addTag('chat', 'Chat and messaging functionality')
    .addTag('websocket', 'WebSocket real-time communication')
    .addCookieAuth('auth-token', {
      type: 'http',
      in: 'cookie',
      scheme: 'bearer',
      description: 'Authentication token stored in httpOnly cookie',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.ISTACK_BUDDY_BACKEND_SERVER_HOST_PORT || 3500;
  await app.listen(port);

  console.log(`🚀 iStack Buddy Server running on: http://localhost:${port}`);
  console.log(
    `📚 API Documentation available at: http://localhost:${port}/api`,
  );
  console.log(`🌐 CORS enabled for ALL origins (temporary)`);
}

// Only run bootstrap if this file is executed directly (not imported)
if (require.main === module) {
  bootstrap();
}
