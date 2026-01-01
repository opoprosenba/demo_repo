const sql = require('mssql');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: false, // SQL Server 2012 不支持加密
    trustServerCertificate: true,
  }
};

async function checkDatabase() {
  try {
    // 连接数据库
    await sql.connect(config);
    console.log('✅ 数据库连接成功');

    // 检查enroll表结构
    console.log('\n📋 检查enroll表结构：');
    const tableInfo = await sql.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'enroll'
    `);
    console.table(tableInfo.recordset);

    // 检查enroll表数据
    console.log('\n📊 检查enroll表数据（前10条）：');
    const enrollData = await sql.query(`SELECT TOP 10 * FROM enroll`);
    console.table(enrollData.recordset);

    // 检查courses表结构
    console.log('\n📋 检查courses表结构：');
    const coursesTableInfo = await sql.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'courses'
    `);
    console.table(coursesTableInfo.recordset);

    // 检查SQL Server版本
    console.log('\n🖥️  SQL Server版本信息：');
    const versionInfo = await sql.query(`SELECT @@VERSION AS version`);
    console.log(versionInfo.recordset[0].version);

    // 尝试简化的STRING_AGG查询
    console.log('\n🔍 测试简化的STRING_AGG查询：');
    try {
      const testQuery = await sql.query(`
        SELECT 
          e.student_id,
          STRING_AGG(c.course_name, ',') AS course_names
        FROM enroll e
        INNER JOIN courses c ON e.course_id = c.course_id
        WHERE e.status = 'approved'
        GROUP BY e.student_id
        ORDER BY e.student_id
      `);
      console.log('✅ STRING_AGG查询成功！');
      console.table(testQuery.recordset);
    } catch (err) {
      console.log('❌ STRING_AGG查询失败：');
      console.log(err.message);
    }

  } catch (err) {
    console.error('❌ 数据库操作失败：');
    console.error(err.message);
  } finally {
    // 关闭连接
    await sql.close();
    console.log('\n🔌 数据库连接已关闭');
  }
}

checkDatabase();
