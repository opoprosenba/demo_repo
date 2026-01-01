const express = require('express');
const cors = require('cors');
const { pool, testDbConnection } = require('./db');
require('dotenv').config();
const sql = require('mssql');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// 日志记录函数
const logger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.originalUrl}`);
  console.log(`Request Body:`, JSON.stringify(req.body, null, 2));
  
  // 记录响应状态码
  const originalSend = res.send;
  res.send = function(body) {
    console.log(`${timestamp} - Response Status: ${res.statusCode}`);
    console.log(`Response Body:`, JSON.stringify(JSON.parse(body), null, 2));
    return originalSend.call(this, body);
  };
  
  next();
};

const app = express();
const PORT = process.env.API_PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-keep-it-safe'; 

// 中间件
const allowedOrigins = new Set([
  'http://127.0.0.1:8080',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:8000',
  'http://localhost:8000',
  'null', // file:// loads are reported as literal "null"
  undefined,
  null
]);

app.use(cors({
  origin: (origin, callback) => {
    if (allowedOrigins.has(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 使用日志中间件
app.use(logger);

// 全局错误中间件
app.use((err, req, res, next) => {
  console.error('全局错误捕获:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404处理中间件
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `路径 ${req.originalUrl} 不存在`
  });
});

// 测试数据库连接
testDbConnection()
  .then(ensureSchema)
  .catch((err) => {
    console.error('初始化数据库结构失败：', err);
    process.exit(1);
  });

async function ensureSchema() {
  try {
    await pool.request().query(`
      IF COL_LENGTH('students', 'balance') IS NULL
      BEGIN
        ALTER TABLE students
        ADD balance DECIMAL(10, 2) NOT NULL CONSTRAINT DF_students_balance DEFAULT (0);
      END;

      IF COL_LENGTH('enroll', 'paid_amount') IS NULL
      BEGIN
        ALTER TABLE enroll
        ADD paid_amount DECIMAL(10, 2) NULL;
      END;

      IF COL_LENGTH('courses', 'is_deleted') IS NULL
      BEGIN
        ALTER TABLE courses
        ADD is_deleted BIT NOT NULL CONSTRAINT DF_courses_is_deleted DEFAULT (0);
      END;
    `);
    console.log('✅ 数据表结构检查完成（必需字段已存在）');
  } catch (err) {
    console.error('❌ 数据表结构检查失败：', err);
    throw err;
  }
}

// -------------------------- 认证中间件（验证Token） --------------------------
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; 

  if (!token) return res.status(401).json({ success: false, message: '未提供Token' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: 'Token无效或已过期' });
    req.user = user;
    next();
  });
};

// -------------------------- 认证API --------------------------
// 登录接口（已正确返回relatedId，无需修改）
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    // 查询用户（包含related_id字段）
    const result = await pool.request()
      .input('username', sql.NVarChar, username)
      .query('SELECT * FROM users WHERE username = @username');

    const user = result.recordset[0];
    if (!user) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    // 支持明文密码和bcrypt加密密码验证
    let isPasswordValid = false;
    
    // 先尝试明文验证（适配数据库中的明文存储）
    isPasswordValid = password === user.password;
    console.log('【调试】明文验证结果：', isPasswordValid);
    
    // 如果明文验证失败，尝试bcrypt验证（支持新创建的加密密码）
    if (!isPasswordValid) {
      try {
        isPasswordValid = await bcrypt.compare(password, user.password);
        console.log('【调试】bcrypt验证结果：', isPasswordValid);
      } catch (err) {
        console.error('【调试】bcrypt验证出错：', err);
      }
    }

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    // 检查用户状态
    if (user.status === 'disabled') {
      return res.status(401).json({ success: false, message: '账号已被禁用，请联系管理员' });
    }

    // 生成Token（包含relatedId）
    const token = jwt.sign(
      { 
        userId: user.user_id, 
        username: user.username, 
        role: user.role, 
        relatedId: user.related_id 
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.status(200).json({
      success: true,
      message: '登录成功',
      token,
      user: {
        username: user.username,
        role: user.role,
        relatedId: user.related_id // 正确返回relatedId
      }
    });
  } catch (err) {
    console.error('登录接口错误：', err);
    res.status(500).json({ success: false, message: '登录失败', error: err.message });
  }
});

// 验证Token接口
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Token有效',
    user: req.user
  });
});

// 退出登录（前端清除Token，后端无需操作）
app.post('/api/auth/logout', (req, res) => {
  res.status(200).json({ success: true, message: '退出成功' });
});

// -------------------------- 用户管理API --------------------------
// 获取用户列表
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限访问' });
    }

    const result = await pool.request().query('SELECT * FROM users ORDER BY user_id ASC');
    res.status(200).json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('获取用户列表错误：', err);
    res.status(500).json({ success: false, message: '获取用户失败', error: err.message });
  }
});

// 修改用户状态
app.put('/api/users/:id/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '无权限操作' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (isNaN(id)) return res.status(400).json({ success: false, message: '用户ID必须是数字' });

    // 检查并创建status字段（如果不存在）
    await pool.request().query(`
      IF COL_LENGTH('users', 'status') IS NULL
      BEGIN
        ALTER TABLE users
        ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_users_status DEFAULT ('enabled');
      END;
    `);

    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar(20), status)
      .query('UPDATE users SET status = @status WHERE user_id = @id');

    res.status(200).json({
      success: true,
      message: '用户状态修改成功',
      affectedRows: result.rowsAffected[0]
    });
  } catch (err) {
    console.error('修改用户状态错误：', err);
    res.status(500).json({ success: false, message: '操作失败', error: err.message });
  }
});

// 新增用户（带重复校验）
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: '无权限新增用户' 
      });
    }

    const { user_id, username, password, role, related_id } = req.body;

    // 1. 基础验证
    const errors = [];
    if (!user_id || isNaN(user_id)) errors.push('用户ID必须是数字');
    if (!username || username.trim() === '') errors.push('用户名不能为空');
    if (!password) errors.push('密码不能为空');
    if (!['admin', 'teacher', 'student'].includes(role)) errors.push('角色只能是admin/teacher/student');

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join('；') });
    }

    // 2. 查询用户名是否已存在（核心：避免唯一约束冲突）
    const checkUser = await pool.request()
      .input('username', sql.NVarChar(50), username.trim())
      .query('SELECT username FROM users WHERE username = @username');

    if (checkUser.recordset.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `用户名「${username}」已存在，请更换` 
      });
    }

    // 3. 密码加密
    const hashedPassword = await bcrypt.hash(password, 10); 

    // 4. 执行插入
    const result = await pool.request()
      .input('user_id', sql.Int, user_id)
      .input('username', sql.NVarChar(50), username.trim())
      .input('password', sql.NVarChar(255), hashedPassword) 
      .input('role', sql.NVarChar(20), role)
      .input('related_id', sql.Int, related_id || null)
      .query(`
        INSERT INTO users (user_id, username, password, role, related_id)
        VALUES (@user_id, @username, @password, @role, @related_id)
      `);

    res.status(201).json({
      success: true,
      message: `用户「${username}」新增成功`,
      affectedRows: result.rowsAffected[0]
    });
  } catch (err) {
    console.error('新增用户失败：', err);
    res.status(500).json({ 
      success: false, 
      message: '新增用户失败', 
      error: err.message 
    });
  }
});

// 重置测试数据API（关键修改：适配数字账号体系）
app.post('/api/users/reset-test-data', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '仅管理员可重置测试数据' });
    }

    // 步骤1：清空users表
    await pool.request().query('DELETE FROM users');

    // 步骤2：插入数字账号测试用户（核心修改）
    const testUsers = [
      { user_id: 1, username: '000', password: '123456', role: 'admin', related_id: null }, // 管理员数字账号000
      { user_id: 2, username: '101', password: '123456', role: 'teacher', related_id: 101 }, // 教师数字账号101，related_id匹配讲师ID
      { user_id: 3, username: '201', password: '123456', role: 'student', related_id: 201 }, // 学员数字账号201，related_id匹配学员ID
      { user_id: 4, username: '102', password: '123456', role: 'teacher', related_id: 102 }, // 新增教师账号102
      { user_id: 5, username: '202', password: '123456', role: 'student', related_id: 202 }  // 新增学员账号202
    ];

    for (const user of testUsers) {
      await pool.request()
        .input('user_id', sql.Int, user.user_id)
        .input('username', sql.NVarChar(50), user.username)
        .input('password', sql.NVarChar(255), user.password) 
        .input('role', sql.NVarChar(20), user.role)
        .input('related_id', sql.Int, user.related_id)
        .query(`
          INSERT INTO users (user_id, username, password, role, related_id)
          VALUES (@user_id, @username, @password, @role, @related_id)
        `);
    }

    res.status(200).json({
      success: true,
      message: '测试数据重置成功！默认账号：000/123456（管理员），101/123456（教师），201/123456（学员）'
    });
  } catch (err) {
    console.error('重置测试数据失败：', err);
    res.status(500).json({ 
      success: false, 
      message: '重置测试数据失败', 
      error: err.message 
    });
  }
});

// -------------------------- 仪表盘统计API --------------------------
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const courseResult = await pool.request().query('SELECT COUNT(*) AS count FROM courses');
    const teacherResult = await pool.request().query('SELECT COUNT(*) AS count FROM teachers');
    const studentResult = await pool.request().query('SELECT COUNT(*) AS count FROM students');

    res.status(200).json({
      success: true,
      data: {
        courseCount: courseResult.recordset[0].count,
        teacherCount: teacherResult.recordset[0].count,
        studentCount: studentResult.recordset[0].count
      }
    });
  } catch (err) {
    console.error('仪表盘统计错误：', err);
    res.status(500).json({ success: false, message: '获取统计数据失败', error: err.message });
  }
});

// -------------------------- 报名管理API --------------------------
// 获取报名列表
app.get('/api/enroll', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT DISTINCT
        e.*,
        s.student_name,
        c.course_name,
        c.course_id,
        c.teacher_id,
        c.price,
        c.status AS course_status,
        t.teacher_name
      FROM enroll e
      LEFT JOIN students s ON e.student_id = s.student_id
      LEFT JOIN courses c ON e.course_id = c.course_id
      LEFT JOIN teachers t ON c.teacher_id = t.teacher_id
    `;

    let hasWhere = false;
    if (req.user.role === 'student') {
      query += ` WHERE e.student_id = @student_id`;
      hasWhere = true;
    }
    
    // 支持通过student_id参数过滤
    if (req.query.student_id && !isNaN(req.query.student_id)) {
      if (!hasWhere) {
        query += ` WHERE`;
        hasWhere = true;
      } else {
        query += ` AND`;
      }
      query += ` e.student_id = @query_student_id`;
    }
    
    // 支持通过student_name参数过滤
    if (req.query.student_name) {
      if (!hasWhere) {
        query += ` WHERE`;
        hasWhere = true;
      } else {
        query += ` AND`;
      }
      query += ` s.student_name LIKE @student_name`;
    }

    // 支持通过course_name参数过滤
    if (req.query.course_name) {
      if (!hasWhere) {
        query += ` WHERE`;
        hasWhere = true;
      } else {
        query += ` AND`;
      }
      query += ` c.course_name LIKE @course_name`;
    }

    const request = pool.request();
    if (req.user.role === 'student') {
      request.input('student_id', sql.Int, req.user.relatedId);
    }
    
    if (req.query.student_id && !isNaN(req.query.student_id)) {
      request.input('query_student_id', sql.Int, req.query.student_id);
    }
    
    if (req.query.student_name) {
      request.input('student_name', sql.NVarChar(50), `%${req.query.student_name}%`);
    }
    
    if (req.query.course_name) {
      request.input('course_name', sql.NVarChar(50), `%${req.query.course_name}%`);
    }

    const result = await request.query(query);
    res.status(200).json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('获取报名列表错误：', err);
    res.status(500).json({ success: false, message: '获取报名数据失败', error: err.message });
  }
});

// 学员报名课程
app.post('/api/enroll', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: '仅学员可报名' });
    }

    const { course_id } = req.body;
    const student_id = req.user.relatedId;

    if (!course_id || isNaN(course_id)) {
      return res.status(400).json({ success: false, message: '课程ID必须是数字' });
    }

    if (!student_id || isNaN(student_id)) {
      return res.status(400).json({ success: false, message: '学生ID无效，无法报名' });
    }

    const courseInfo = await pool.request()
      .input('course_id', sql.Int, course_id)
      .query('SELECT course_id, price, status, course_name, is_deleted FROM courses WHERE course_id = @course_id AND is_deleted = 0;');

    if (courseInfo.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '课程不存在，无法报名' });
    }

    const course = courseInfo.recordset[0];
    if (course.status === '已结业') {
      return res.status(400).json({ success: false, message: '课程已结业，无法报名' });
    }

    const checkRepeat = await pool.request()
      .input('student_id', sql.Int, student_id)
      .input('course_id', sql.Int, course_id)
      .query(`
        SELECT 1
        FROM enroll
        WHERE student_id = @student_id
          AND course_id = @course_id
          AND status IN ('pending', 'approved')
      `);

    if (checkRepeat.recordset.length > 0) {
      return res.status(400).json({ success: false, message: '已报名该课程' });
    }

    const studentInfo = await pool.request()
      .input('student_id', sql.Int, student_id)
      .query('SELECT student_id, ISNULL(balance, 0) AS balance FROM students WHERE student_id = @student_id');

    if (studentInfo.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '未找到学员信息' });
    }

    const studentBalance = Number(studentInfo.recordset[0].balance || 0);
    const coursePrice = Number(Number(course.price || 0).toFixed(2));

    if (studentBalance < coursePrice) {
      return res.status(400).json({ success: false, message: '余额不足，请先充值后再报名' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
    const enroll_id = Date.now() % 1000000 + Math.floor(Math.random() * 1000);

      const insertRequest = new sql.Request(transaction);
      await insertRequest
      .input('enroll_id', sql.Int, enroll_id)
      .input('student_id', sql.Int, student_id)
      .input('course_id', sql.Int, course_id)
      .input('enroll_time', sql.DateTime, new Date())
      .input('status', sql.NVarChar(20), 'pending')
        .input('paid_amount', sql.Decimal(10, 2), coursePrice)
      .query(`
          INSERT INTO enroll (enroll_id, student_id, course_id, enroll_time, status, paid_amount)
          VALUES (@enroll_id, @student_id, @course_id, @enroll_time, @status, @paid_amount)
      `);

      const balanceRequest = new sql.Request(transaction);
      await balanceRequest
        .input('student_id', sql.Int, student_id)
        .input('amount', sql.Decimal(10, 2), coursePrice)
        .query(`
          UPDATE students
          SET balance = ISNULL(balance, 0) - @amount
          WHERE student_id = @student_id
        `);

      await transaction.commit();

      res.status(201).json({
        success: true,
        message: '报名成功，等待审核',
        affectedRows: 1,
        remainingBalance: Number((studentBalance - coursePrice).toFixed(2))
      });
    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }
  } catch (err) {
    console.error('报名课程错误：', err);
    res.status(500).json({ success: false, message: '报名失败', error: err.message });
  }
});

// 审核报名
app.put('/api/enroll/:id/approve', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '仅管理员可审核' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (isNaN(id)) return res.status(400).json({ success: false, message: '报名ID必须是数字' });
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: '状态只能是approved/rejected/pending' });
    }

    const enrollDetail = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT e.enroll_id, e.status AS enroll_status, e.student_id, e.course_id, ISNULL(c.price, 0) AS course_price, e.paid_amount, e.enroll_time
        FROM enroll e
        LEFT JOIN courses c ON e.course_id = c.course_id
        WHERE e.enroll_id = @id
      `);

    if (enrollDetail.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '报名记录不存在' });
    }

    const record = enrollDetail.recordset[0];
    const originalStatus = record.enroll_status;
    const paidAmount = record.paid_amount !== undefined && record.paid_amount !== null
      ? Number(record.paid_amount)
      : Number(record.course_price);
    const needsRefund = status === 'rejected' && originalStatus !== 'rejected' && paidAmount > 0;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const updateRequest = new sql.Request(transaction);
      await updateRequest
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar(20), status)
      .query('UPDATE enroll SET status = @status WHERE enroll_id = @id');

      let newBalance = null;
      if (needsRefund) {
        const refundRequest = new sql.Request(transaction);
        const refundResult = await refundRequest
          .input('student_id', sql.Int, record.student_id)
          .input('amount', sql.Decimal(10, 2), paidAmount)
          .query(`
            UPDATE students
            SET balance = ISNULL(balance, 0) + @amount
            OUTPUT INSERTED.balance AS balance
            WHERE student_id = @student_id
          `);
        newBalance = refundResult.recordset[0]?.balance ?? null;
      }

      const courseRequest = new sql.Request(transaction);
      if (status === 'approved') {
        await courseRequest
          .input('student_id', sql.Int, record.student_id)
          .input('course_id', sql.Int, record.course_id)
          .query(`
            UPDATE students
            SET course_id = @course_id
            WHERE student_id = @student_id AND (course_id IS NULL OR course_id <> @course_id)
          `);
      } else if (status === 'rejected' && originalStatus === 'approved') {
        await courseRequest
          .input('student_id', sql.Int, record.student_id)
          .input('course_id', sql.Int, record.course_id)
          .query(`
            UPDATE students
            SET course_id = NULL
            WHERE student_id = @student_id AND course_id = @course_id
          `);
      }

      await transaction.commit();
    } catch (transactionErr) {
      await transaction.rollback();
      throw transactionErr;
    }

    const actionText = status === 'approved' ? '通过' : status === 'rejected' ? '拒绝' : '重置';
    const extraTip = needsRefund ? `，费用¥${paidAmount.toFixed(2)}已退回学员余额` : '';

    res.status(200).json({
      success: true,
      message: `报名已${actionText}${extraTip}`,
      affectedRows: 1,
      refund: needsRefund ? paidAmount : 0
    });
  } catch (err) {
    console.error('审核报名错误：', err);
    res.status(500).json({ success: false, message: '审核失败', error: err.message });
  }
});

// -------------------------- 课程管理API（完整CRUD） --------------------------
// 获取所有课程（关联讲师名称）
app.get('/api/courses', authenticateToken, async (req, res) => {
  try {
    console.log('开始查询课程列表，执行SQL：关联courses和teachers表');
    
    let query = `
      SELECT 
        c.course_id,
        c.course_name,
        c.teacher_id,
        ISNULL(t.teacher_name, '无') AS teacher_name,
        c.price,
        c.status,
        c.description,
        c.create_time
      FROM courses c
      LEFT JOIN teachers t ON c.teacher_id = t.teacher_id
      WHERE c.is_deleted = 0
    `;
    
    const request = pool.request();
    
    // 支持通过course_id参数过滤
    if (req.query.course_id && !isNaN(req.query.course_id)) {
      query += ` AND c.course_id = @course_id`;
      request.input('course_id', sql.Int, req.query.course_id);
    }
    
    // 支持通过course_name参数过滤
    if (req.query.course_name) {
      query += ` AND c.course_name LIKE @course_name`;
      request.input('course_name', sql.NVarChar(100), `%${req.query.course_name}%`);
    }
    
    query += ` ORDER BY c.course_id ASC`;
    
    const result = await request.query(query);

    console.log(`查询成功，共返回 ${result.recordset.length} 条课程数据`);
    res.status(200).json({
      success: true,
      data: result.recordset,
      total: result.recordset.length
    });
  } catch (err) {
    console.error('【获取课程列表失败】完整错误：', err);
    res.status(500).json({
      success: false,
      message: '获取课程列表失败',
      error: err.message
    });
  }
});

// 获取学生可报名的课程列表
app.get('/api/courses/available', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: '仅学生可查看可报名课程' });
    }

    if (!req.user.relatedId || isNaN(req.user.relatedId)) {
      return res.status(400).json({ success: false, message: '学生ID无效，无法查询课程' });
    }

    const result = await pool.request()
      .input('student_id', sql.Int, req.user.relatedId)
      .query(`
        SELECT 
          c.course_id,
          c.course_name,
          c.teacher_id,
          ISNULL(t.teacher_name, '无') AS teacher_name,
          c.price,
          c.status,
          c.description,
          c.create_time
        FROM courses c
        LEFT JOIN teachers t ON c.teacher_id = t.teacher_id
        LEFT JOIN enroll e
          ON e.course_id = c.course_id
          AND e.student_id = @student_id
          AND e.status IN ('pending', 'approved')
        WHERE e.enroll_id IS NULL
          AND c.status IN ('未开始', '进行中')
          AND c.is_deleted = 0
        ORDER BY c.course_id ASC
      `);

    res.status(200).json({
      success: true,
      data: result.recordset,
      total: result.recordset.length
    });
  } catch (err) {
    console.error('【获取可报名课程失败】', err);
    res.status(500).json({
      success: false,
      message: '获取可报名课程失败',
      error: err.message
    });
  }
});

// 获取单个课程（通过课程ID）
app.get('/api/courses/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: '课程ID必须是数字'
      });
    }

    const result = await pool.request()
      .input('course_id', sql.Int, id)
      .query(`
        SELECT 
          c.course_id,
          c.course_name,
          c.teacher_id,
          t.teacher_name,
          c.price,
          c.status,
          c.description,
          c.create_time
        FROM courses c
        LEFT JOIN teachers t ON c.teacher_id = t.teacher_id
        WHERE c.course_id = @course_id AND c.is_deleted = 0
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `课程ID=${id}不存在`
      });
    }

    res.status(200).json({
      success: true,
      data: result.recordset[0]
    });
  } catch (err) {
    console.error(`【获取课程ID=${req.params.id}失败】错误详情：`, err);
    res.status(500).json({
      success: false,
      message: '获取单个课程失败',
      error: err.message
    });
  }
});

// 新增课程
app.post('/api/courses', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const teacherId = req.user.role === 'teacher' ? req.user.relatedId : req.body.teacher_id;

    const { course_id, course_name, price, status, description } = req.body;

    const errors = [];
    if (!course_id || isNaN(course_id)) errors.push('课程ID必须填写且为数字');
    if (!course_name || course_name.trim() === '') errors.push('课程名称不能为空');
    if (!price || isNaN(price) || price <= 0) errors.push('课程价格必须是大于0的数字');
    if (!['未开始', '进行中', '已结业'].includes(status)) errors.push('课程状态只能是：未开始/进行中/已结业');

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join('；')
      });
    }

    // 检查课程ID是否已存在（包括软删除的记录）
    const checkExisting = await pool.request()
      .input('course_id', sql.Int, course_id)
      .query('SELECT course_id, is_deleted FROM courses WHERE course_id = @course_id;');

    if (teacherId) {
      const checkTeacher = await pool.request()
        .input('teacher_id', sql.Int, teacherId)
        .query('SELECT teacher_id FROM teachers WHERE teacher_id = @teacher_id');

      if (checkTeacher.recordset.length === 0) {
        return res.status(400).json({
          success: false,
          message: `讲师ID=${teacherId}不存在，无法关联`
        });
      }
    }

    let result;
    if (checkExisting.recordset.length > 0) {
      // 课程ID已存在
      const course = checkExisting.recordset[0];
      if (course.is_deleted === 0) {
        // 未删除的课程，不允许重复
        return res.status(400).json({
          success: false,
          message: `课程ID=${course_id}已存在，请更换其他ID`
        });
      } else {
        // 已软删除的课程，执行更新操作恢复
        result = await pool.request()
          .input('course_id', sql.Int, course_id)
          .input('course_name', sql.NVarChar(100), course_name.trim())
          .input('teacher_id', sql.Int, teacherId || null)
          .input('price', sql.Decimal(10, 2), price)
          .input('status', sql.NVarChar(20), status)
          .input('description', sql.Text, description ? description.trim() : null)
          .query(`
            UPDATE courses
            SET 
              course_name = @course_name,
              teacher_id = @teacher_id,
              price = @price,
              status = @status,
              description = @description,
              is_deleted = 0
            WHERE course_id = @course_id
          `);
        res.status(201).json({
          success: true,
          message: `课程《${course_name}》已恢复并更新成功`,
          affectedRows: result.rowsAffected[0],
          course_id: course_id
        });
      }
    } else {
      // 课程ID不存在，执行插入操作
      result = await pool.request()
        .input('course_id', sql.Int, course_id)
        .input('course_name', sql.NVarChar(100), course_name.trim())
        .input('teacher_id', sql.Int, teacherId || null)
        .input('price', sql.Decimal(10, 2), price)
        .input('status', sql.NVarChar(20), status)
        .input('description', sql.Text, description ? description.trim() : null)
        .input('create_time', sql.DateTime, new Date())
        .query(`
          INSERT INTO courses (course_id, course_name, teacher_id, price, status, description, create_time)
          VALUES (@course_id, @course_name, @teacher_id, @price, @status, @description, @create_time)
        `);
      res.status(201).json({
        success: true,
        message: `课程《${course_name}》新增成功`,
        affectedRows: result.rowsAffected[0],
        course_id: course_id
      });
    }
  } catch (err) {
    console.error('【新增课程失败】错误详情：', err);
    res.status(500).json({
      success: false,
      message: '新增课程失败',
      error: err.message
    });
  }
});

// 修改课程
app.put('/api/courses/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { course_name, teacher_id, price, status, description } = req.body;

    const isAdmin = req.user.role === 'admin';
    let courseTeacherId = null;
    if (!isAdmin) {
      const courseResult = await pool.request()
        .input('course_id', sql.Int, id)
        .query('SELECT teacher_id FROM courses WHERE course_id = @course_id AND is_deleted = 0;');
      if (courseResult.recordset.length === 0) {
        return res.status(404).json({ success: false, message: '课程不存在' });
      }
      courseTeacherId = courseResult.recordset[0].teacher_id;
      if (req.user.role === 'teacher' && courseTeacherId !== req.user.relatedId) {
        return res.status(403).json({ success: false, message: '无权限修改他人课程' });
      }
    }

    if (isNaN(id)) return res.status(400).json({ success: false, message: '课程ID必须是数字' });

    const checkExist = await pool.request()
      .input('course_id', sql.Int, id)
      .query('SELECT * FROM courses WHERE course_id = @course_id AND is_deleted = 0;');

    if (checkExist.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `课程ID=${id}不存在，无法修改`
      });
    }

    const errors = [];
    if (course_name && course_name.trim() === '') errors.push('课程名称不能为空');
    if (price && (isNaN(price) || price <= 0)) errors.push('课程价格必须是大于0的数字');
    if (status && !['未开始', '进行中', '已结业'].includes(status)) errors.push('课程状态只能是：未开始/进行中/已结业');

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join('；')
      });
    }

    if (teacher_id !== undefined && teacher_id !== null) {
      const checkTeacher = await pool.request()
        .input('teacher_id', sql.Int, teacher_id)
        .query('SELECT teacher_id FROM teachers WHERE teacher_id = @teacher_id');

      if (checkTeacher.recordset.length === 0) {
        return res.status(400).json({
          success: false,
          message: `讲师ID=${teacher_id}不存在，无法关联`
        });
      }
    }

    const result = await pool.request()
      .input('course_id', sql.Int, id)
      .input('new_course_name', sql.NVarChar(100), course_name ? course_name.trim() : checkExist.recordset[0].course_name)
      .input('new_teacher_id', sql.Int, teacher_id === undefined ? checkExist.recordset[0].teacher_id : teacher_id)
      .input('new_price', sql.Decimal(10, 2), price === undefined ? checkExist.recordset[0].price : (price ? price : null))
      .input('new_status', sql.NVarChar(20), status === undefined ? checkExist.recordset[0].status : (status ? status : null))
      .input('new_description', sql.Text, description === undefined ? checkExist.recordset[0].description : (description ? description.trim() : null))
      .query(`
        UPDATE courses
        SET 
          course_name = @new_course_name,
          teacher_id = @new_teacher_id,
          price = @new_price,
          status = @new_status,
          description = @new_description
        WHERE course_id = @course_id
      `);

    res.status(200).json({
      success: true,
      message: '课程修改成功',
      affectedRows: result.rowsAffected[0]
    });
  } catch (err) {
    console.error(`【修改课程ID=${id}失败】错误详情：`, err);
    res.status(500).json({
      success: false,
      message: '修改课程失败',
      error: err.message
    });
  }
});

// 删除课程
app.delete('/api/courses/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '仅管理员可删除课程' });
    }

    const { id } = req.params;

    if (isNaN(id)) return res.status(400).json({ success: false, message: '课程ID必须是数字' });

    const courseInfo = await pool.request()
      .input('course_id', sql.Int, id)
      .query('SELECT course_id, status FROM courses WHERE course_id = @course_id');

    if (courseInfo.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `课程ID=${id}不存在，无法删除`
      });
    }

    const course = courseInfo.recordset[0];
    if (course.status !== '已结业') {
      return res.status(400).json({
        success: false,
        message: `只能删除已结业的课程，当前课程状态为：${course.status}`
      });
    }

    const result = await pool.request()
      .input('course_id', sql.Int, id)
      .query('UPDATE courses SET is_deleted = 1 WHERE course_id = @course_id');

    res.status(200).json({
      success: true,
      message: `课程ID=${id}删除成功`,
      affectedRows: result.rowsAffected[0]
    });
  } catch (err) {
    console.error(`【删除课程ID=${id}失败】错误详情：`, err);
    res.status(500).json({
      success: false,
      message: '删除课程失败',
      error: err.message
    });
  }
});

// -------------------------- 讲师管理API（完整CRUD） --------------------------
// 获取所有讲师
app.get('/api/teachers', authenticateToken, async (req, res) => {
  try {
    let query = 'SELECT * FROM teachers';
    
    const request = pool.request();
    let hasWhere = false;
    
    // 支持通过teacher_id参数过滤
    if (req.query.teacher_id && !isNaN(req.query.teacher_id)) {
      query += ` WHERE teacher_id = @teacher_id`;
      request.input('teacher_id', sql.Int, req.query.teacher_id);
      hasWhere = true;
    }
    
    // 支持通过teacher_name参数过滤
    if (req.query.teacher_name) {
      if (!hasWhere) {
        query += ` WHERE`;
        hasWhere = true;
      } else {
        query += ` AND`;
      }
      query += ` teacher_name LIKE @teacher_name`;
      request.input('teacher_name', sql.NVarChar(50), `%${req.query.teacher_name}%`);
    }
    
    query += ` ORDER BY teacher_id ASC`;
    
    const result = await request.query(query);
    res.status(200).json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('【获取讲师列表失败】错误详情：', err);
    res.status(500).json({ success: false, message: '获取讲师列表失败', error: err.message });
  }
});

// 获取单个讲师
app.get('/api/teachers/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ success: false, message: '讲师ID必须是数字' });

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM teachers WHERE teacher_id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '讲师不存在' });
    }
    res.status(200).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('【获取单个讲师失败】错误详情：', err);
    res.status(500).json({ success: false, message: '获取讲师失败', error: err.message });
  }
});

// 新增讲师
app.post('/api/teachers', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '仅管理员可新增讲师' });
    }

    const { teacher_id, teacher_name, major, phone, email } = req.body;

    // 全面的输入验证
    const errors = [];
    if (!teacher_id) {
      errors.push('讲师ID不能为空');
    } else if (isNaN(teacher_id)) {
      errors.push('讲师ID必须是数字');
    } else if (parseInt(teacher_id) <= 0) {
      errors.push('讲师ID必须大于0');
    }
    
    if (!teacher_name) {
      errors.push('讲师姓名不能为空');
    } else if (teacher_name.trim() === '') {
      errors.push('讲师姓名不能只包含空格');
    }
    
    if (phone) {
      if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
        errors.push('电话号码必须是11位有效手机号码');
      }
    }
    
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errors.push('邮箱格式不正确');
      }
    }
    
    if (major && major.trim().length > 100) {
      errors.push('专业长度不能超过100个字符');
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join('；') });
    }

    // 检查讲师ID是否已存在
    const checkRepeat = await pool.request()
      .input('id', sql.Int, teacher_id)
      .query('SELECT * FROM teachers WHERE teacher_id = @id');
    if (checkRepeat.recordset.length > 0) {
      return res.status(400).json({ success: false, message: `讲师ID${teacher_id}已存在` });
    }
    
    // 检查用户名是否已存在（避免重复创建用户账号）
    const checkUser = await pool.request()
      .input('username', sql.NVarChar(50), teacher_id.toString())
      .query('SELECT * FROM users WHERE username = @username');
    if (checkUser.recordset.length > 0) {
      return res.status(400).json({ success: false, message: `用户名${teacher_id}已存在，无法创建讲师账号` });
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    // 使用更可靠的事务处理方式
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // 插入讲师信息
      const teacherRequest = new sql.Request(transaction);
      await teacherRequest
        .input('teacher_id', sql.Int, teacher_id)
        .input('teacher_name', sql.NVarChar(50), teacher_name.trim())
        .input('major', sql.NVarChar(100), major ? major.trim() : null)
        .input('phone', sql.VarChar(25), phone ? phone.trim() : null)
        .input('email', sql.NVarChar(150), email ? email.trim() : null)
        .query(`INSERT INTO teachers (teacher_id, teacher_name, major, phone, email)
                VALUES (@teacher_id, @teacher_name, @major, @phone, @email)`);
      
      // 插入用户账号
      const userRequest = new sql.Request(transaction);
      await userRequest
        .input('username', sql.NVarChar(50), teacher_id.toString())
        .input('password', sql.NVarChar(255), hashedPassword)
        .input('role', sql.NVarChar(20), 'teacher')
        .input('related_id', sql.Int, teacher_id)
        .query(`INSERT INTO users (username, password, role, related_id)
                VALUES (@username, @password, @role, @related_id)`);
      
      // 提交事务
      await transaction.commit();

      res.status(201).json({
        success: true,
        message: `讲师${teacher_name}新增成功，同时创建了讲师账号`,
        affectedRows: 2 // 影响了两条记录：teachers和users
      });
    } catch (transactionErr) {
      // 回滚事务
      await transaction.rollback();
      console.error('【新增讲师事务失败】错误详情：', transactionErr);
      res.status(500).json({ success: false, message: '新增讲师失败，事务已回滚', error: transactionErr.message });
    }
  } catch (err) {
    console.error('【新增讲师失败】错误详情：', err);
    res.status(500).json({ success: false, message: '新增讲师失败', error: err.message });
  }
});

// 修改讲师
app.put('/api/teachers/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '仅管理员可修改讲师' });
    }

    const { id } = req.params;
    const { teacher_name, major, phone, email } = req.body;

    // 全面的输入验证
    const errors = [];
    if (isNaN(id)) {
      errors.push('讲师ID必须是数字');
    } else if (parseInt(id) <= 0) {
      errors.push('讲师ID必须大于0');
    }
    
    if (teacher_name && teacher_name.trim() === '') {
      errors.push('讲师姓名不能只包含空格');
    }
    
    if (major && major.trim() === '') {
      errors.push('讲师专业不能只包含空格');
    } else if (major && major.trim().length > 100) {
      errors.push('讲师专业长度不能超过100个字符');
    }
    
    if (phone) {
      if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
        errors.push('电话号码必须是11位有效手机号码');
      }
    }
    
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errors.push('邮箱格式不正确');
      } else if (email.length > 150) {
        errors.push('邮箱长度不能超过150个字符');
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join('；') });
    }

    const checkExist = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM teachers WHERE teacher_id = @id');
    if (checkExist.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '讲师不存在' });
    }

    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('teacher_name', sql.NVarChar(50), teacher_name ? teacher_name.trim() : checkExist.recordset[0].teacher_name)
      .input('major', sql.NVarChar(100), major ? major.trim() : checkExist.recordset[0].major)
      .input('phone', sql.VarChar(25), phone !== undefined ? (phone ? phone.trim() : null) : checkExist.recordset[0].phone)
      .input('email', sql.NVarChar(150), email !== undefined ? (email ? email.trim() : null) : checkExist.recordset[0].email)
      .query(`
        UPDATE teachers
        SET teacher_name = @teacher_name, major = @major, phone = @phone, email = @email
        WHERE teacher_id = @id
      `);

    res.status(200).json({ success: true, message: '讲师修改成功', affectedRows: result.rowsAffected[0] });
  } catch (err) {
    console.error('【修改讲师失败】错误详情：', err);
    res.status(500).json({ success: false, message: '修改讲师失败', error: err.message });
  }
});

// 删除讲师
app.delete('/api/teachers/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '仅管理员可删除讲师' });
    }

    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ success: false, message: '讲师ID必须是数字' });

    const checkExist = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT teacher_id FROM teachers WHERE teacher_id = @id');
    if (checkExist.recordset.length === 0) {
      return res.status(404).json({ success: false, message: `讲师ID=${id}不存在` });
    }

    const checkCourse = await pool.request()
      .input('teacher_id', sql.Int, id)
      .query('SELECT course_id FROM courses WHERE teacher_id = @teacher_id');
    const relatedCourses = checkCourse.recordset.length;

    // 使用更可靠的显式事务处理方式
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // 删除对应的用户账号
      const userRequest = new sql.Request(transaction);
      await userRequest
        .input('id', sql.Int, id)
        .query('DELETE FROM users WHERE username = @id AND role = \'teacher\'');
      
      // 删除讲师信息
      const teacherRequest = new sql.Request(transaction);
      const teacherResult = await teacherRequest
        .input('id', sql.Int, id)
        .query('DELETE FROM teachers WHERE teacher_id = @id');
      
      await transaction.commit();
      
      if (teacherResult.rowsAffected[0] === 1) {
        const relatedTip = relatedCourses > 0 ? `，关联的${relatedCourses}门课程已解除讲师关联` : '';
        res.status(200).json({
          success: true,
          message: `讲师删除成功${relatedTip}`,
          affectedRows: teacherResult.rowsAffected[0]
        });
      } else {
        res.status(400).json({ success: false, message: '讲师删除失败' });
      }
    } catch (transactionErr) {
      // 回滚事务
      await transaction.rollback();
      console.error('【删除讲师事务失败】错误详情：', transactionErr);
      res.status(500).json({ 
        success: false, 
        message: '删除讲师失败，事务已回滚', 
        error: transactionErr.message 
      });
    }
  } catch (err) {
    console.error(`【删除讲师ID=${id}失败】错误详情：`, err);
    res.status(500).json({
      success: false,
      message: '删除讲师失败',
      error: err.message
    });
  }
});

// 教师查看自己课程的报名情况
app.get('/api/teachers/me/enrollments', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: '仅教师可查看课程报名情况' });
    }

    if (!req.user.relatedId || isNaN(req.user.relatedId)) {
      return res.status(400).json({ success: false, message: '教师ID无效，无法查询' });
    }

    const result = await pool.request()
      .input('teacher_id', sql.Int, req.user.relatedId)
      .query(`
        SELECT 
          c.course_id,
          c.course_name,
          c.price,
          c.status,
          e.enroll_id,
          e.enroll_time,
          e.status AS enroll_status,
          s.student_id,
          s.student_name,
          s.phone
        FROM courses c
        LEFT JOIN enroll e ON c.course_id = e.course_id
        LEFT JOIN students s ON e.student_id = s.student_id
        WHERE c.teacher_id = @teacher_id AND c.is_deleted = 0
        ORDER BY c.course_id ASC, e.enroll_time DESC
      `);

    const courseMap = new Map();
    result.recordset.forEach(record => {
      if (!courseMap.has(record.course_id)) {
        courseMap.set(record.course_id, {
          course_id: record.course_id,
          course_name: record.course_name,
          price: record.price,
          status: record.status,
          students: []
        });
      }

      if (record.enroll_id) {
        const courseData = courseMap.get(record.course_id);
        courseData.students.push({
          enroll_id: record.enroll_id,
          student_id: record.student_id,
          student_name: record.student_name,
          phone: record.phone,
          status: record.enroll_status,
          enroll_time: record.enroll_time
        });
      }
    });

    res.status(200).json({
      success: true,
      data: Array.from(courseMap.values())
    });
  } catch (err) {
    console.error('教师获取报名情况失败：', err);
    res.status(500).json({ success: false, message: '获取报名情况失败', error: err.message });
  }
});

// -------------------------- 学员管理API（完整CRUD） --------------------------
// 获取所有学员（关联课程名称）
app.get('/api/students', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        s.*,
        ec.course_names AS course_name
      FROM students s
      LEFT JOIN (
        SELECT 
          e.student_id,
          STRING_AGG(c.course_name, ',') AS course_names
        FROM (
          SELECT DISTINCT student_id, course_id 
          FROM enroll 
          WHERE status = 'approved'
        ) e
        INNER JOIN courses c ON e.course_id = c.course_id
        GROUP BY e.student_id
      ) ec ON s.student_id = ec.student_id
    `;
    
    const request = pool.request();
    let hasWhere = false;
    
    // 支持通过student_id参数过滤
    if (req.query.student_id && !isNaN(req.query.student_id)) {
      query += ` WHERE s.student_id = @student_id`;
      request.input('student_id', sql.Int, req.query.student_id);
      hasWhere = true;
    }
    
    // 支持通过student_name参数过滤
    if (req.query.student_name) {
      if (!hasWhere) {
        query += ` WHERE`;
        hasWhere = true;
      } else {
        query += ` AND`;
      }
      query += ` s.student_name LIKE @student_name`;
      request.input('student_name', sql.NVarChar(50), `%${req.query.student_name}%`);
    }
    
    query += ` ORDER BY s.student_id ASC`;
    
    const result = await request.query(query);
    res.status(200).json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('【获取学员列表失败】错误详情：', err);
    res.status(500).json({ success: false, message: '获取学员列表失败', error: err.message });
  }
});

// 获取单个学员
app.get('/api/students/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(id)) return res.status(400).json({ success: false, message: '学员ID必须是数字' });

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT 
          s.*,
          ec.course_names AS course_name
        FROM students s
        LEFT JOIN (
          SELECT 
            e.student_id,
            STRING_AGG(c.course_name, ',') AS course_names
          FROM (
            SELECT DISTINCT student_id, course_id 
            FROM enroll 
            WHERE status = 'approved'
          ) e
          INNER JOIN courses c ON e.course_id = c.course_id
          GROUP BY e.student_id
        ) ec ON s.student_id = ec.student_id
        WHERE s.student_id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '学员不存在' });
    }
    res.status(200).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error('【获取单个学员失败】错误详情：', err);
    res.status(500).json({ success: false, message: '获取学员失败', error: err.message });
  }
});

// 新增学员
app.post('/api/students', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '仅管理员可新增学员' });
    }

    const { student_id, student_name, gender, phone, course_id } = req.body;

    // 全面的输入验证
    const errors = [];
    if (!student_id) {
      errors.push('学员ID不能为空');
    } else if (isNaN(student_id)) {
      errors.push('学员ID必须是数字');
    } else if (parseInt(student_id) <= 0) {
      errors.push('学员ID必须大于0');
    }
    
    if (!student_name) {
      errors.push('学员姓名不能为空');
    } else if (student_name.trim() === '') {
      errors.push('学员姓名不能只包含空格');
    }
    
    if (phone) {
      if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
        errors.push('电话号码必须是11位有效手机号码');
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join('；') });
    }

    // 检查学员ID是否已存在
    const checkStudent = await pool.request()
      .input('id', sql.Int, student_id)
      .query('SELECT * FROM students WHERE student_id = @id');
    if (checkStudent.recordset.length > 0) {
      return res.status(400).json({ success: false, message: `学员ID${student_id}已存在` });
    }
    
    // 检查用户名是否已存在（避免重复创建用户账号）
    const checkUser = await pool.request()
      .input('username', sql.NVarChar(50), student_id.toString())
      .query('SELECT * FROM users WHERE username = @username');
    if (checkUser.recordset.length > 0) {
      return res.status(400).json({ success: false, message: `用户名${student_id}已存在，无法创建学员账号` });
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    // 使用更可靠的显式事务处理方式
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // 插入学员信息
      const studentRequest = new sql.Request(transaction);
      await studentRequest
        .input('student_id', sql.Int, student_id)
        .input('student_name', sql.NVarChar(50), student_name.trim())
        .input('gender', sql.NVarChar(4), gender ? gender.trim() : null)
        .input('phone', sql.VarChar(25), phone ? phone.trim() : null)
        .input('course_id', sql.Int, course_id ? course_id : null)
        .query(`INSERT INTO students (student_id, student_name, gender, phone, course_id)
                VALUES (@student_id, @student_name, @gender, @phone, @course_id)`);
      
      // 插入用户账号
      const userRequest = new sql.Request(transaction);
      await userRequest
        .input('username', sql.NVarChar(50), student_id.toString())
        .input('password', sql.NVarChar(255), hashedPassword)
        .input('role', sql.NVarChar(20), 'student')
        .input('related_id', sql.Int, student_id)
        .query(`INSERT INTO users (username, password, role, related_id)
                VALUES (@username, @password, @role, @related_id)`);
      
      // 提交事务
      await transaction.commit();

      res.status(201).json({
        success: true,
        message: `学员${student_name}新增成功，同时创建了学生账号`,
        affectedRows: 2 // 影响了两条记录：students和users
      });
    } catch (transactionErr) {
      // 回滚事务
      await transaction.rollback();
      console.error('【新增学员事务失败】错误详情：', transactionErr);
      res.status(500).json({ success: false, message: '新增学员失败，事务已回滚', error: transactionErr.message });
    }
  } catch (err) {
    console.error('【新增学员失败】错误详情：', err);
    res.status(500).json({ success: false, message: '新增学员失败', error: err.message });
  }
});

// 修改学员
app.put('/api/students/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '仅管理员可修改学员' });
    }

    const { id } = req.params;
    const { student_name, gender, phone, course_id } = req.body;

    // 全面的输入验证
    const errors = [];
    if (isNaN(id)) {
      errors.push('学员ID必须是数字');
    } else if (parseInt(id) <= 0) {
      errors.push('学员ID必须大于0');
    }
    
    if (student_name && student_name.trim() === '') {
      errors.push('学员姓名不能只包含空格');
    }
    
    if (gender && !['男', '女', '未知'].includes(gender.trim())) {
      errors.push('性别只能是：男/女/未知');
    }
    
    if (phone) {
      if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
        errors.push('电话号码必须是11位有效手机号码');
      }
    }
    
    if (course_id && (isNaN(course_id) || parseInt(course_id) <= 0)) {
      errors.push('课程ID必须是大于0的数字');
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join('；') });
    }

    const checkExist = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM students WHERE student_id = @id');
    if (checkExist.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '学员不存在' });
    }

    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('student_name', sql.NVarChar(50), student_name ? student_name.trim() : checkExist.recordset[0].student_name)
      .input('gender', sql.NVarChar(4), gender ? gender.trim() : checkExist.recordset[0].gender)
      .input('phone', sql.VarChar(25), phone !== undefined ? (phone ? phone.trim() : null) : checkExist.recordset[0].phone)
      .input('course_id', sql.Int, course_id !== undefined ? course_id : checkExist.recordset[0].course_id)
      .query(`
        UPDATE students
        SET student_name = @student_name, gender = @gender, phone = @phone, course_id = @course_id
        WHERE student_id = @id
      `);

    res.status(200).json({ success: true, message: '学员修改成功', affectedRows: result.rowsAffected[0] });
  } catch (err) {
    console.error('【修改学员失败】错误详情：', err);
    res.status(500).json({ success: false, message: '修改学员失败', error: err.message });
  }
});

// 删除学员
app.delete('/api/students/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: '仅管理员可删除学员' });
    }

    if (isNaN(id)) return res.status(400).json({ success: false, message: '学员ID必须是数字' });

    const checkExist = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT student_id FROM students WHERE student_id = @id');
    if (checkExist.recordset.length === 0) {
      return res.status(404).json({ success: false, message: `学员ID=${id}不存在` });
    }

    // 使用更可靠的显式事务处理方式
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // 删除学员的报名记录
      const enrollRequest = new sql.Request(transaction);
      await enrollRequest
        .input('id', sql.Int, id)
        .query('DELETE FROM enroll WHERE student_id = @id');
      
      // 删除学员的用户账号
      const userRequest = new sql.Request(transaction);
      await userRequest
        .input('id', sql.Int, id)
        .query('DELETE FROM users WHERE role = \'student\' AND related_id = @id');
      
      // 删除学员信息
      const studentRequest = new sql.Request(transaction);
      const studentResult = await studentRequest
        .input('id', sql.Int, id)
        .query('DELETE FROM students WHERE student_id = @id');
      
      await transaction.commit();
      
      if (studentResult.rowsAffected[0] === 1) {
        res.status(200).json({
          success: true,
          message: `学员ID=${id}及其账号删除成功`,
          affectedRows: {
            students: studentResult.rowsAffected[0]
          }
        });
      } else {
        res.status(400).json({ success: false, message: '学员删除失败' });
      }
    } catch (transactionErr) {
      // 回滚事务
      await transaction.rollback();
      console.error('【删除学员事务失败】错误详情：', transactionErr);
      res.status(500).json({ 
        success: false, 
        message: '删除学员失败，事务已回滚', 
        error: transactionErr.message 
      });
    }
  } catch (err) {
    console.error(`【删除学员ID=${id}失败】错误详情：`, err);
    res.status(500).json({
      success: false,
      message: '删除学员失败',
      error: err.message
    });
  }
});

// 获取当前学生余额
app.get('/api/students/me/balance', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: '仅学生可查看余额' });
    }

    if (!req.user.relatedId || isNaN(req.user.relatedId)) {
      return res.status(400).json({ success: false, message: '学生ID无效，无法查询余额' });
    }

    const result = await pool.request()
      .input('student_id', sql.Int, req.user.relatedId)
      .query('SELECT ISNULL(balance, 0) AS balance FROM students WHERE student_id = @student_id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '未找到学员信息' });
    }

    res.status(200).json({
      success: true,
      data: { balance: Number(result.recordset[0].balance || 0) }
    });
  } catch (err) {
    console.error('获取学生余额失败：', err);
    res.status(500).json({ success: false, message: '获取余额失败', error: err.message });
  }
});

// 学生充值接口
app.post('/api/students/recharge', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: '仅学生可充值' });
    }

    const { amount } = req.body;
    if (amount === undefined || amount === null || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: '充值金额必须是大于0的数字' });
    }

    if (!req.user.relatedId || isNaN(req.user.relatedId)) {
      return res.status(400).json({ success: false, message: '学生ID无效，无法充值' });
    }

    const normalizedAmount = Number(Number(amount).toFixed(2));

    const updateResult = await pool.request()
      .input('student_id', sql.Int, req.user.relatedId)
      .input('amount', sql.Decimal(10, 2), normalizedAmount)
      .query(`
        UPDATE students
        SET balance = ISNULL(balance, 0) + @amount
        OUTPUT INSERTED.balance AS balance
        WHERE student_id = @student_id
      `);

    if (updateResult.recordset.length === 0) {
      return res.status(404).json({ success: false, message: '未找到学员信息，充值失败' });
    }

    res.status(200).json({
      success: true,
      message: '充值成功',
      balance: Number(updateResult.recordset[0].balance || 0)
    });
  } catch (err) {
    console.error('学生充值失败：', err);
    res.status(500).json({ success: false, message: '充值失败', error: err.message });
  }
});

// -------------------------- 启动服务 --------------------------
const server = app.listen(PORT, () => {
  console.log(`🚀 后端API服务已启动！访问地址：http://localhost:${PORT}`);
  console.log(`📌 登录接口：http://localhost:${PORT}/api/auth/login`);
  console.log(`🔑 默认测试账号：000/123456（管理员），101/123456（教师），201/123456（学员）`);
});

// 优雅关闭服务器和数据库连接
const gracefulShutdown = async () => {
  console.log('\n🔄 正在关闭服务器...');
  try {
    // 关闭数据库连接池
    await pool.close();
    console.log('✅ 数据库连接池已关闭');
    
    // 关闭服务器
    server.close(() => {
      console.log('✅ 服务器已关闭');
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ 关闭服务器时出错：', err);
    process.exit(1);
  }
};

// 监听退出信号
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGQUIT', gracefulShutdown);
process.on('uncaughtException', (err) => {
  console.error('❌ 未捕获的异常：', err);
  gracefulShutdown();
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝：', reason);
  gracefulShutdown();
});