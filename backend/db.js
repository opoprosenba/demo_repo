const sql = require('mssql');
require('dotenv').config();

// SQL Server连接配置（读取.env文件）
const dbConfig = {
  server: process.env.DB_SERVER,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT),
  options: {
    encrypt: false, // 本地数据库关闭加密（远程可开启）
    trustServerCertificate: true, // 信任自签名证书（避免SSL错误）
    connectTimeout: 30000 // 连接超时时间
  }
};

// 创建连接池（提高性能，避免重复创建连接）
const pool = new sql.ConnectionPool(dbConfig);

// 测试数据库连接（启动服务时执行）
async function testDbConnection() {
  try {
    await pool.connect();
    console.log(`✅ 数据库连接成功！账号：px，数据库：${process.env.DB_NAME}`);
  } catch (err) {
    console.error('❌ 数据库连接失败：', err.message);
    console.error('请检查：1. SQL Server服务是否启动 2. 账号px/123456是否正确 3. 数据库名称是否存在');
    process.exit(1); // 连接失败退出服务
  }
}

module.exports = { pool, testDbConnection };