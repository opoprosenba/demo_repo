const mssql = require('mssql');
require('dotenv').config();

// 数据库配置
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false
  }
};

// 执行查询
async function checkCourseStatus() {
  try {
    // 连接数据库
    const pool = await mssql.connect(config);
    console.log('数据库连接成功');

    // 查询courses表结构
    const tableStructure = await pool.request().query(`
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE, 
        IS_NULLABLE,
        COLUMNPROPERTY(OBJECT_ID('courses'), COLUMN_NAME, 'IsIdentity') AS IsIdentity
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'courses'
      ORDER BY ORDINAL_POSITION
    `);
    console.log('\nCourses表结构:');
    console.table(tableStructure.recordset);

    // 查询主键信息
    const primaryKey = await pool.request().query(`
      SELECT 
        kcu.COLUMN_NAME 
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS tc 
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS kcu 
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME 
        AND tc.TABLE_NAME = kcu.TABLE_NAME 
      WHERE tc.TABLE_NAME = 'courses' AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
    `);
    console.log('\n主键字段:', primaryKey.recordset.map(col => col.COLUMN_NAME).join(', '));

    // 查询课程205的状态
    const course205 = await pool.request().query(`
      SELECT course_id, course_name, is_deleted, status 
      FROM courses 
      WHERE course_id = 205
    `);
    console.log('\n课程205的状态:');
    console.table(course205.recordset);

    // 查询所有课程的is_deleted状态
    const allCourses = await pool.request().query(`
      SELECT course_id, course_name, is_deleted, status 
      FROM courses 
      ORDER BY course_id
    `);
    console.log('\n所有课程的状态:');
    console.table(allCourses.recordset);

    // 关闭连接
    await pool.close();
  } catch (error) {
    console.error('查询失败:', error);
  }
}

// 运行查询
checkCourseStatus();