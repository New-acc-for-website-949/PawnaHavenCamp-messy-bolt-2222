const bcrypt = require('bcrypt');
const { Client } = require('pg');
require('dotenv').config();

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: node update_admin.js <email> <password>');
  process.exit(1);
}

async function updateAdmin() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);

    const res = await client.query(
      'UPDATE admins SET email = $1, password_hash = $2 WHERE id = (SELECT id FROM admins LIMIT 1) RETURNING email',
      [email, hash]
    );

    if (res.rowCount > 0) {
      console.log(`Success! Admin email updated to: ${res.rows[0].email}`);
    } else {
      console.log('No admin user found to update.');
    }
  } catch (err) {
    console.error('Error updating admin:', err);
  } finally {
    await client.end();
  }
}

updateAdmin();
