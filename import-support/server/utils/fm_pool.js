// MSSQL connection utility for Nuxt API
import sql from 'mssql';

const config = {
  user: process.env.FM_DB_USER || 'sa',
  password: process.env.FM_DB_PASSWORD || '',
  server: process.env.FM_DB_SERVER || 'localhost',
  database: process.env.FM_DB_DATABASE || 'test',
  options: {
    encrypt: false, // Set to true for Azure
    trustServerCertificate: true, // Change to false for production
  },
};

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

export { pool, poolConnect, sql };
