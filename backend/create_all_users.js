require('dotenv').config();
const { pool } = require('./db');
const sql = require('mssql');

async function createAllUsers() {
  try {
    console.log('开始连接数据库...');
    await pool.connect();
    console.log('数据库连接成功！');

    // 1. 查询所有学生
    const studentsResult = await pool.request().query('SELECT * FROM students');
    const students = studentsResult.recordset;
    console.log(`\n发现 ${students.length} 个学生`);

    // 2. 查询所有教师
    const teachersResult = await pool.request().query('SELECT * FROM teachers');
    const teachers = teachersResult.recordset;
    console.log(`发现 ${teachers.length} 个教师`);

    // 3. 为每个学生创建用户记录
    for (const student of students) {
      const username = student.student_id.toString();
      const password = '123456';
      const role = 'student';
      const related_id = student.student_id;

      // 检查用户是否已存在
      const checkUser = await pool.request()
        .input('username', sql.NVarChar, username)
        .query('SELECT * FROM users WHERE username = @username');

      if (checkUser.recordset.length === 0) {
        // 创建新用户
        await pool.request()
          .input('username', sql.NVarChar, username)
          .input('password', sql.NVarChar, password)
          .input('role', sql.NVarChar, role)
          .input('related_id', sql.Int, related_id)
          .query(`
            INSERT INTO users (username, password, role, related_id, created_at, updated_at)
            VALUES (@username, @password, @role, @related_id, GETDATE(), GETDATE())
          `);
        console.log(`✓ 创建学生用户: ${username} (密码: ${password})`);
      } else {
        console.log(`→ 学生用户已存在: ${username}`);
      }
    }

    // 4. 为每个教师创建用户记录
    for (const teacher of teachers) {
      const username = teacher.teacher_id.toString();
      const password = '123456';
      const role = 'teacher';
      const related_id = teacher.teacher_id;

      // 检查用户是否已存在
      const checkUser = await pool.request()
        .input('username', sql.NVarChar, username)
        .query('SELECT * FROM users WHERE username = @username');

      if (checkUser.recordset.length === 0) {
        // 创建新用户
        await pool.request()
          .input('username', sql.NVarChar, username)
          .input('password', sql.NVarChar, password)
          .input('role', sql.NVarChar, role)
          .input('related_id', sql.Int, related_id)
          .query(`
            INSERT INTO users (username, password, role, related_id, created_at, updated_at)
            VALUES (@username, @password, @role, @related_id, GETDATE(), GETDATE())
          `);
        console.log(`✓ 创建教师用户: ${username} (密码: ${password})`);
      } else {
        console.log(`→ 教师用户已存在: ${username}`);
      }
    }

    // 5. 确保管理员用户存在
    const adminUsername = '000';
    const checkAdmin = await pool.request()
      .input('username', sql.NVarChar, adminUsername)
      .query('SELECT * FROM users WHERE username = @username');

    if (checkAdmin.recordset.length === 0) {
      await pool.request()
        .input('username', sql.NVarChar, adminUsername)
        .input('password', sql.NVarChar, '123456')
        .input('role', sql.NVarChar, 'admin')
        .query(`
          INSERT INTO users (username, password, role, created_at, updated_at)
          VALUES (@username, @password, @role, GETDATE(), GETDATE())
        `);
      console.log(`✓ 创建管理员用户: ${adminUsername} (密码: 123456)`);
    } else {
      console.log(`→ 管理员用户已存在: ${adminUsername}`);
    }

    // 6. 显示最终的用户列表
    console.log('\n=== 创建完成后的用户列表 ===');
    const finalUsers = await pool.request().query('SELECT * FROM users ORDER BY role, username');
    console.log(`总用户数: ${finalUsers.recordset.length}`);
    console.log('用户列表:');
    finalUsers.recordset.forEach(user => {
      console.log(`${user.role.padEnd(7)} | ${user.username.padEnd(5)} | 密码: 123456`);
    });

    await pool.close();
    console.log('\n✅ 所有用户创建完成！');
  } catch (err) {
    console.error('创建用户失败:', err);
  }
}

createAllUsers();
