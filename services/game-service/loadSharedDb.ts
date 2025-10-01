import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.NODE_ENV === 'production'
  ? join(__dirname, '../../Shared_dataBase/db-connection.js')
  : join(__dirname, '../../../Shared_dataBase/db-connection.js');

console.log('Loading shared database from:', dbPath);

const { default: db } = await import(dbPath);

export default db;