import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import { json } from 'express';
import { CustomLoggerService } from './common/logger/custom-logger.service';

// Load environment variables from .env.live file (real keys for development/production)
dotenv.config({ path: '.env.live' });

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = app.get(CustomLoggerService);

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

  // Serve test data files statically
  app.use(
    '/test-data',
    require('express').static('test-data', {
      etag: false, // Disable ETag for development
      lastModified: false, // Disable Last-Modified for development
      maxAge: 0, // No caching for development
    }),
  );

  // Serve form-marv static app (this should come before the controller routes)
  app.use(
    '/public/form-marv',
    require('express').static('public-content/form-marv', {
      index: ['index.html'], // Serve index.html automatically for directory requests
      fallthrough: true, // Continue to next middleware if file not found (allows API routes to work)
      etag: false, // Disable ETag for development
      lastModified: false, // Disable Last-Modified for development
      maxAge: 0, // No caching for development
    }),
  );

  app.use(
    '/public/form-marv/_next',
    require('express').static('public-content/form-marv/_next', {
      etag: false, // Disable ETag for development
      lastModified: false, // Disable Last-Modified for development
      maxAge: 0, // No caching for development
    }),
  );
  app.use(
    '/public/form-marv/favicon.ico',
    require('express').static('public-content/form-marv/favicon.ico'),
  );

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

  logger.log(`iStack Buddy Server running on: http://localhost:${port}`);
  logger.log(`API Documentation available at: http://localhost:${port}/api`);
  logger.warn(`CORS enabled for ALL origins (temporary)`);
}

// Only run bootstrap if this file is executed directly (not imported)
if (require.main === module) {
  bootstrap();
}
