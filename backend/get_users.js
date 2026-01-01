const { pool, testDbConnection } = require('./db');

async function getUsers() {
  try {
    await testDbConnection();
    const result = await pool.request().query('SELECT * FROM users');
    console.log('Users:', result.recordset);
    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

getUsers();