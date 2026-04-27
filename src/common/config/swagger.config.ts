import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Bookersi API Documentation')
    .setDescription(
      'Official API documentation for Bookersi - The ultimate booking and business management platform. ' +
        'Explore our industry-level API endpoints with a Postman-like interactive experience.',
    )
    .setVersion('1.0.0')
    .setContact(
      'Bookersi Support',
      'https://bookersi.com',
      'support@bookersi.com',
    )
    .setLicense('Bookersi Proprietary', 'https://bookersi.com/terms')
    // Add JWT Bearer authentication globally
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter your JWT access token to authenticate requests.',
        in: 'header',
      },
      'JWT-auth', // This is the security name
    )
    // Add common tags for organization
    .addTag('auth', 'Authentication and authorization endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('business', 'Business listing and management')
    .addTag('booking', 'Booking and reservation management')
    .addTag('service', 'Service management')
    .addTag('staff', 'Staff and availability management')
    .addTag('review', 'Business reviews and ratings')
    .addTag('wishlist', 'User wishlists')
    .addTag('payment', 'Payment processing')
    .addTag('contact', 'Contact and support')
    .addTag('admin', 'Administrative operations')
    .addTag('health', 'Health check endpoints')
    .addTag('metrics', 'Metrics and monitoring endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Integrate Scalar API Reference for a Postman-like experience
  app.use(
    '/docs',
    apiReference({
      theme: 'deepSpace',
      layout: 'modern',
      defaultHttpClient: {
        targetKey: 'js',
        clientKey: 'fetch',
      },
      content: document,
      customCss: `
        .scalar-app {
          --scalar-brand: #7c3aed;
          --scalar-button-1: #7c3aed;
        }
      `,
    }),
  );

  // Optional: Keep standard Swagger UI at /swagger-ui for fallback
  SwaggerModule.setup('swagger-ui', app, document, {
    customSiteTitle: 'Bookersi API - Swagger UI',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });
}
