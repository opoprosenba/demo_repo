require('dotenv').config({ path: './backend/.env' });
const { pool } = require('./backend/db');

async function checkDatabase() {
  try {
    console.log('开始连接数据库...');
    await pool.connect();
    console.log('数据库连接成功！');

    // 查询用户表
    console.log('\n=== 用户表内容 ===');
    const usersResult = await pool.request().query('SELECT * FROM users');
    console.log('用户数量:', usersResult.recordset.length);
    console.log('用户列表:', usersResult.recordset);

    // 查询学生表
    console.log('\n=== 学生表内容 ===');
    const studentsResult = await pool.request().query('SELECT * FROM students');
    console.log('学生数量:', studentsResult.recordset.length);
    console.log('学生列表:', studentsResult.recordset);

    // 查询教师表
    console.log('\n=== 教师表内容 ===');
    const teachersResult = await pool.request().query('SELECT * FROM teachers');
    console.log('教师数量:', teachersResult.recordset.length);
    console.log('教师列表:', teachersResult.recordset);

    await pool.close();
  } catch (err) {
    console.error('数据库操作失败:', err);
  }
}

checkDatabase();
