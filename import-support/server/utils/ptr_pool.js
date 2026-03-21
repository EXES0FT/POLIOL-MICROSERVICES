// MySQL connection utility for Nuxt API
import mysql from 'mysql2/promise';

const ptrPool = mysql.createPool({
  host: process.env.PTR_DB_HOST || 'localhost',
  user: process.env.PTR_DB_USER || 'root',
  password: process.env.PTR_DB_PASSWORD || '',
  database: process.env.PTR_DB_DATABASE || 'test',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const ptrSql = mysql;

export { ptrPool, ptrSql };
