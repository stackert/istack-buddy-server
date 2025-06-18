#!/usr/bin/env ts-node

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Simple logging utility for database scripts
class DatabaseLogger {
  private formatMessage(
    level: string,
    operation: string,
    message: string,
    data?: any,
  ): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: 'DatabaseScript',
      operation,
      message,
      data: data || undefined,
    };
    return JSON.stringify(logEntry);
  }

  log(operation: string, message: string, data?: any): void {
    console.log(this.formatMessage('info', operation, message, data));
  }

  error(operation: string, message: string, error?: Error, data?: any): void {
    const errorData = {
      ...data,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };
    console.error(this.formatMessage('error', operation, message, errorData));
  }

  warn(operation: string, message: string, data?: any): void {
    console.warn(this.formatMessage('warn', operation, message, data));
  }
}

const logger = new DatabaseLogger();

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  timezone: string;
}

interface Config {
  development: DatabaseConfig;
  test: DatabaseConfig;
  production: DatabaseConfig;
}

async function loadConfig(): Promise<DatabaseConfig> {
  const configPath = path.join(process.cwd(), 'config', 'database.json');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const config: Config = JSON.parse(configFile);

  const environment = process.env.NODE_ENV || 'development';
  const dbConfig = config[environment as keyof Config];

  // Replace environment variables in production config
  if (environment === 'production') {
    return {
      ...dbConfig,
      host: process.env.DB_HOST || dbConfig.host,
      port: parseInt(process.env.DB_PORT || dbConfig.port.toString()),
      database: process.env.DB_NAME || dbConfig.database,
      username: process.env.DB_USERNAME || dbConfig.username,
      password: process.env.DB_PASSWORD || dbConfig.password,
    };
  }

  return dbConfig;
}

async function createDatabase() {
  const config = await loadConfig();

  logger.log('create-database', '🔧 Creating database...', {
    environment: process.env.NODE_ENV || 'development',
    host: config.host,
    port: config.port,
    database: config.database,
  });

  // Connect to postgres database to create/drop target database
  const adminClient = new Client({
    host: config.host,
    port: config.port,
    database: 'postgres', // Connect to default postgres database
    user: config.username,
    password: config.password,
    ssl: config.ssl,
  });

  try {
    await adminClient.connect();

    // Terminate existing connections to target database
    console.log('🔄 Terminating existing connections...');
    await adminClient.query(
      `
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `,
      [config.database],
    );

    // Drop database if exists
    console.log('🗑️  Dropping existing database...');
    await adminClient.query(`DROP DATABASE IF EXISTS "${config.database}"`);

    // Create database
    console.log('🆕 Creating new database...');
    await adminClient.query(`CREATE DATABASE "${config.database}"`);

    await adminClient.end();

    // Connect to the new database to run schema
    console.log('📋 Running database schema...');
    const dbClient = new Client({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl,
    });

    await dbClient.connect();

    // Set timezone
    await dbClient.query(`SET timezone = '${config.timezone}'`);

    // Read and execute schema file
    const schemaPath = path.join(
      process.cwd(),
      'docs-living',
      'database',
      '00001-database-schema.sql',
    );

    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }

    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    console.log('⚙️  Executing schema...');
    await dbClient.query(schemaSQL);

    await dbClient.end();

    logger.log('create-database', '✅ Database created successfully!', {
      database: config.database,
      host: config.host,
      port: config.port,
    });
  } catch (error) {
    console.error('❌ Error creating database:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createDatabase()
    .then(() => {
      console.log('🎉 Database creation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database creation failed:', error);
      process.exit(1);
    });
}

export { createDatabase };
