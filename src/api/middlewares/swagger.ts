import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Dropdesk API',
            version: '1.0.0',
            description: 'API documentation for Dropdesk workspace and media sharing',
        },
        servers: [
            {
                url: 'https://dropdesk.0bhishek.com',
                description: 'Prod server',
            },
            {
                url: 'http://localhost:8000',
                description: 'Local dev server',
            },
        ],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'auth_token',
                },
            },
        },
        security: [
            {
                cookieAuth: [],
            },
        ],
    },
    // Paths to files containing OpenAPI definitions
    apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.controller.ts', './src/api/server.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { swaggerOptions: { withCredentials: true } }));
};