import 'dotenv/config';
import pg from 'pg';

const sql = process.argv[2];
if (!sql) {
  console.error('Please provide a SQL query. Example: npm run db:query "SELECT * FROM orders"');
  process.exit(1);
}

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

const client = new pg.Client(getDbConfig(process.env.DATABASE_URL));

try {
  await client.connect();
  const res = await client.query(sql);
  if (res.rows && res.rows.length > 0) {
    console.table(res.rows);
  } else {
    console.log(`Success: ${res.command} (${res.rowCount ?? 0} row(s) affected)`);
  }
} catch (err) {
  console.error('Query Error:', err.message);
} finally {
  await client.end();
}
