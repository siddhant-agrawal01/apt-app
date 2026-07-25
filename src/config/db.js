import pg from 'pg';

const { Pool } = pg;

function getDbConfig(url) {
  if (!url) return {};
  const isCloudOrSsl = url.includes('sslmode=') ||
                       url.includes('aivencloud.com') ||
                       url.includes('neon.tech') ||
                       url.includes('supabase.co');

  const cleanUrl = url.replace(/\?sslmode=[^&]*/, '');

  return {
    connectionString: cleanUrl,
    ...(isCloudOrSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

const pool = new Pool(getDbConfig(process.env.DATABASE_URL));

pool.on('connect', () => {
  console.log('[db] Successfully connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client:', err.message);
});

export default pool;
