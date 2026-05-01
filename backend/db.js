const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        user: 'postgres',
        host: 'localhost',
        database: 'his_biomedico',
        password: '12345678',
        port: 5432,
      }
);

module.exports = pool;