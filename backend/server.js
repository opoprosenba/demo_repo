const express = require('express');
const cors = require('cors');
const { pool } = require('./config/db'); // 导入数据库连接
const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const { authenticateToken } = require('./middleware/authMiddleware'); // 导入认证中间件

const app = express();
const PORT = process.env.PORT || 3000;

// 全局中间件
app.use(cors({ origin: 'http://127.0.0.1:8080', credentials: true })); // 允许前端跨域
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 挂载路由（所有/api开头的接口）
app.use('/api/auth', authRoutes);       // 认证路由
app.use('/api/courses', courseRoutes); // 课程路由

// 启动服务
app.listen(PORT, () => {
  console.log(`后端服务启动于 http://localhost:${PORT}`);
});