import { DataSource } from 'typeorm';
import path from 'path';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'omnipro',
  password: process.env.DB_PASSWORD || 'omnipro_secret_2026',
  database: process.env.DB_NAME || 'omnipro',
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
  entities: [path.join(__dirname, '..', 'entities', '*.{ts,js}')],
  migrations: [path.join(__dirname, '..', 'migrations', '*.{ts,js}')],
});

export async function initializeDatabase(): Promise<DataSource> {
  return AppDataSource.initialize();
}
