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
    encrypt: false,
    trustServerCertificate: true,
  }
};

async function testStringAgg() {
  try {
    await sql.connect(config);
    console.log('✅ 数据库连接成功');

    // 测试1: 带DISTINCT的STRING_AGG
    console.log('\n🔍 测试1: 带DISTINCT的STRING_AGG查询');
    try {
      const test1 = await sql.query(`
        SELECT 
          e.student_id,
          STRING_AGG(DISTINCT c.course_name, ',') AS course_names
        FROM enroll e
        INNER JOIN courses c ON e.course_id = c.course_id
        WHERE e.status = 'approved'
        GROUP BY e.student_id
      `);
      console.log('✅ 带DISTINCT的STRING_AGG查询成功！');
      console.table(test1.recordset);
    } catch (err) {
      console.log('❌ 带DISTINCT的STRING_AGG查询失败：');
      console.log(err.message);
    }

    // 测试2: 完整的原始查询结构（带DISTINCT）
    console.log('\n🔍 测试2: 完整的原始查询结构（带DISTINCT）');
    try {
      const test2 = await sql.query(`
        SELECT 
          s.*,
          ec.course_names AS course_name
        FROM students s
        LEFT JOIN (
          SELECT 
            e.student_id,
            STRING_AGG(DISTINCT c.course_name, ',') AS course_names
          FROM enroll e
          INNER JOIN courses c ON e.course_id = c.course_id
          WHERE e.status = 'approved'
          GROUP BY e.student_id
        ) ec ON s.student_id = ec.student_id
        ORDER BY s.student_id ASC
      `);
      console.log('✅ 完整原始查询成功！');
      console.table(test2.recordset.slice(0, 5)); // 只显示前5条
    } catch (err) {
      console.log('❌ 完整原始查询失败：');
      console.log(err.message);
    }

    // 测试3: 完整的原始查询结构（不带DISTINCT）
    console.log('\n🔍 测试3: 完整的原始查询结构（不带DISTINCT）');
    try {
      const test3 = await sql.query(`
        SELECT 
          s.*,
          ec.course_names AS course_name
        FROM students s
        LEFT JOIN (
          SELECT 
            e.student_id,
            STRING_AGG(c.course_name, ',') AS course_names
          FROM enroll e
          INNER JOIN courses c ON e.course_id = c.course_id
          WHERE e.status = 'approved'
          GROUP BY e.student_id
        ) ec ON s.student_id = ec.student_id
        ORDER BY s.student_id ASC
      `);
      console.log('✅ 不带DISTINCT的完整查询成功！');
      console.table(test3.recordset.slice(0, 5)); // 只显示前5条
    } catch (err) {
      console.log('❌ 不带DISTINCT的完整查询失败：');
      console.log(err.message);
    }

  } catch (err) {
    console.error('❌ 数据库操作失败：');
    console.error(err.message);
  } finally {
    await sql.close();
    console.log('\n🔌 数据库连接已关闭');
  }
}

testStringAgg();
