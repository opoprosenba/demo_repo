// Debug: Check if axios is available when api.js loads
console.log('api.js loading - axios available:', typeof axios !== 'undefined');

// 全局Axios配置：增加超时、优化默认头
axios.defaults.baseURL = 'http://localhost:3003/api';
axios.defaults.headers.post['Content-Type'] = 'application/json';
axios.defaults.timeout = 30000; // 请求超时时间（30秒，兼容慢查询）
axios.defaults.withCredentials = false; // 跨域是否携带Cookie（根据后端配置调整）

// 新增：统一判断开发环境（浏览器兼容）
const isDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname);

// 请求拦截器：自动携带JWT Token + 请求日志（开发环境）
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`; // JWT规范格式，确保后端能解析Token
    }
    
    // 开发环境打印请求日志（替换process.env.NODE_ENV）
    if (isDevelopment) {
      console.log(`[请求] ${config.method?.toUpperCase()} ${config.url}`, config.data || '');
    }
    return config;
  },
  (error) => {
    console.error('[请求错误]', error.message || '未知错误');
    return Promise.reject(error);
  }
);

// 响应拦截器：统一错误处理 + 边界情况优化
axios.interceptors.response.use(
  (response) => {
    // 开发环境打印响应日志（替换process.env.NODE_ENV）
    if (isDevelopment) {
      console.log(`[响应] ${response.config.url}`, response.data);
    }
    return response.data; // 直接返回响应体的data字段
  },
  (error) => {
    // 1. 处理网络错误/无响应的情况
    if (!error.response) {
      const netErrMsg = error.message.includes('timeout') 
        ? '请求超时，请检查网络或稍后重试' 
        : '网络错误，请检查网络连接';
      alert(`操作失败：${netErrMsg}`);
      console.error('[网络错误]', error.message || '未知网络错误');
      return Promise.reject(new Error(netErrMsg));
    }

    // 2. 处理有响应的错误
    const { status, data } = error.response;
    const errMsg = data?.message || `请求失败（状态码：${status}）`;

    // 3. 按状态码分类处理
    switch (status) {
      case 401: // 未登录/Token过期
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        alert('登录已过期或未登录，请重新登录');
        // 避免重复跳转（仅当前页面不是登录页时跳转）
        if (!window.location.pathname.includes('login.html')) {
          window.location.href = 'login.html';
        }
        break;

      case 403: // 权限不足
        alert(`权限不足：${errMsg}`);
        break;

      case 404: // 接口不存在
        alert(`接口不存在：${errMsg}`);
        break;

      case 500: // 后端服务器错误
        alert(`服务器错误：${errMsg || '请联系管理员处理'}`);
        break;

      default: // 其他错误
        alert(`操作失败：${errMsg}`);
    }

    console.error(`[响应错误] ${status}`, errMsg);
    return Promise.reject(new Error(errMsg));
  }
);


// -------------------------- 认证相关API --------------------------
const authApi = {
  // 用户登录
  login: (data) => {
    // 入参校验（可选）
    if (!data?.username || !data?.password) {
      alert('用户名和密码不能为空');
      return Promise.reject(new Error('用户名和密码不能为空'));
    }
    return axios.post('/auth/login', data);
  },
  
  // 验证Token有效性（用于页面刷新时校验）
  verifyToken: () => axios.get('/auth/verify'),
  
  // 退出登录
  logout: () => {
    // 手动构建完整URL，确保路径正确
    return axios.post('/auth/logout')
      .catch(error => {
        console.error('退出登录请求失败:', error);
        // 即使请求失败，仍然执行清理和跳转
        return Promise.resolve();
      })
      .finally(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // 退出后跳转到登录页
        window.location.href = 'login.html';
      });
  }
};

// -------------------------- 用户管理API（仅超级管理员） --------------------------
const userApi = {
  getList: () => axios.get('/users'),
  add: (data) => axios.post('/users', data),
  updateStatus: (id, status) => {
    // 入参校验
    if (!id || !status) {
      alert('用户ID和状态不能为空');
      return Promise.reject(new Error('用户ID和状态不能为空'));
    }
    return axios.put(`/users/${id}/status`, { status });
  },
  getCurrentUser: () => {
    try {
      return JSON.parse(localStorage.getItem('user')) || null;
    } catch (e) {
      console.error('解析用户信息失败', e);
      localStorage.removeItem('user');
      return null;
    }
  }
};

// -------------------------- 仪表盘统计API --------------------------
const dashboardApi = {
  getStats: () => axios.get('/dashboard')
};

// -------------------------- 课程管理API（前端封装，对应后端接口） --------------------------
const courseApi = {
  // 获取课程列表（根据角色自动过滤，支持搜索参数）
  getList: (params = {}) => axios.get('/courses', { params }),

  // 获取所有课程（管理员用，支持搜索参数）
  getAll: (params = {}) => axios.get('/courses', { params }),
  
  // 教师获取自己的课程（核心：对应后端/api/courses/teacher接口，自动携带Token）
  getTeacherCourses: () => axios.get('/courses/teacher'),

  // 学生获取可报名课程
  getAvailable: () => axios.get('/courses/available'),
  
  // 新增课程
  add: (data) => {
    // 入参校验：防止非法参数
    if (!data.course_id || isNaN(data.course_id)) {
      alert('课程ID必须是数字');
      return Promise.reject(new Error('课程ID必须是数字'));
    }
    if (!data.course_name) {
      alert('课程名称不能为空');
      return Promise.reject(new Error('课程名称不能为空'));
    }
    return axios.post('/courses', data);
  },
  
  // 修改课程
  update: (id, data) => {
    if (!id || isNaN(id)) {
      alert('课程ID必须是数字');
      return Promise.reject(new Error('课程ID必须是数字'));
    }
    return axios.put(`/courses/${id}`, data);
  },
  
  // 删除课程
  delete: (id) => {
    if (!id || isNaN(id)) {
      alert('课程ID必须是数字');
      return Promise.reject(new Error('课程ID必须是数字'));
    }
    return axios.delete(`/courses/${id}`);
  },
  
  // 获取单个课程详情
  getOne: (id) => {
    if (!id || isNaN(id)) {
      alert('课程ID必须是数字');
      return Promise.reject(new Error('课程ID必须是数字'));
    }
    return axios.get(`/courses/${id}`);
  }
};

// -------------------------- 讲师相关API --------------------------
const teacherApi = {
  // 获取讲师列表（支持分页/筛选，可选）
  getList: (params = {}) => {
    // 可选：分页参数校验
    if (params.page && isNaN(Number(params.page))) {
      alert('页码必须是数字');
      return Promise.reject(new Error('页码必须是数字'));
    }
    if (params.size && isNaN(Number(params.size))) {
      alert('每页条数必须是数字');
      return Promise.reject(new Error('每页条数必须是数字'));
    }
    return axios.get('/teachers', { params });
  },

  // 获取单个讲师详情（增强ID数字校验）
  getOne: (id) => {
    if (!id) {
      alert('讲师ID不能为空');
      return Promise.reject(new Error('讲师ID不能为空'));
    }
    // 校验ID是否为有效数字
    const teacherId = Number(id);
    if (isNaN(teacherId) || teacherId <= 0) {
      alert('讲师ID必须是正整数');
      return Promise.reject(new Error('讲师ID必须是正整数'));
    }
    return axios.get(`/teachers/${teacherId}`);
  },

  // 添加讲师（增强入参校验）
  add: (data) => {
    // 校验必填字段
    if (!data.teacher_name) {
      alert('讲师姓名不能为空');
      return Promise.reject(new Error('讲师姓名不能为空'));
    }
    if (!data.major) {
      alert('主讲科目不能为空');
      return Promise.reject(new Error('主讲科目不能为空'));
    }
    // 可选：校验手机号/邮箱格式
    if (data.phone && !/^1[3-9]\d{9}$/.test(data.phone)) {
      alert('手机号格式错误');
      return Promise.reject(new Error('手机号格式错误'));
    }
    return axios.post('/teachers', data);
  },

  // 更新讲师信息（增强ID和数据校验）
  update: (id, data) => {
    if (!id) {
      alert('讲师ID不能为空');
      return Promise.reject(new Error('讲师ID不能为空'));
    }
    const teacherId = Number(id);
    if (isNaN(teacherId) || teacherId <= 0) {
      alert('讲师ID必须是正整数');
      return Promise.reject(new Error('讲师ID必须是正整数'));
    }
    // 校验更新数据的必填字段（如姓名）
    if (data.teacher_name === '') {
      alert('讲师姓名不能为空');
      return Promise.reject(new Error('讲师姓名不能为空'));
    }
    return axios.put(`/teachers/${teacherId}`, data);
  },

  // 删除讲师（增强ID校验）
  delete: (id) => {
    if (!id) {
      alert('讲师ID不能为空');
      return Promise.reject(new Error('讲师ID不能为空'));
    }
    const teacherId = Number(id);
    if (isNaN(teacherId) || teacherId <= 0) {
      alert('讲师ID必须是正整数');
      return Promise.reject(new Error('讲师ID必须是正整数'));
    }
    // 二次确认（提升用户体验）
    if (!confirm('确定要删除该讲师吗？删除后相关课程可能受影响')) {
      return Promise.reject(new Error('用户取消删除'));
    }
    return axios.delete(`/teachers/${teacherId}`);
  },

  // 新增：根据用户relatedId获取讲师信息（适配登录教师）
  getByUserId: () => {
    const user = userApi.getCurrentUser();
    if (!user || user.role !== 'teacher') {
      alert('仅教师角色可获取个人信息');
      return Promise.reject(new Error('权限不足'));
    }
    const teacherId = Number(user.relatedId);
    if (isNaN(teacherId) || teacherId <= 0) {
      alert('讲师ID无效');
      return Promise.reject(new Error('讲师ID无效'));
    }
    return axios.get(`/teachers/${teacherId}`);
  },

  // 教师查看自己的课程报名情况
  getEnrollments: () => axios.get('/teachers/me/enrollments')
};

// -------------------------- 学员相关API --------------------------
const studentApi = {
  getList: (params = {}) => { const requestConfig = Object.keys(params).length > 0 ? { params } : {}; return axios.get('/students', requestConfig); },
  getOne: (id) => {
    if (!id) {
      alert('学员ID不能为空');
      return Promise.reject(new Error('学员ID不能为空'));
    }
    const studentId = Number(id);
    if (isNaN(studentId) || studentId <= 0) {
      alert('学员ID必须是正整数');
      return Promise.reject(new Error('学员ID必须是正整数'));
    }
    return axios.get(`/students/${id}`);
  },
  // 学生获取个人信息（增强边界处理）
  getMyInfo: () => {
    const user = userApi.getCurrentUser();
    if (!user) {
      alert('未获取到用户信息，请重新登录');
      return Promise.reject(new Error('未获取到用户信息'));
    }
    if (user.role !== 'student') {
      alert('当前用户非学生角色，无法获取个人信息');
      return Promise.reject(new Error('非学生角色'));
    }
    if (!user.relatedId) {
      alert('学生ID未配置，请联系管理员');
      return Promise.reject(new Error('学生ID未配置'));
    }
    return axios.get(`/students/${user.relatedId}`);
  },
  add: (data) => {
    // 校验必填字段
    if (!data.student_id || isNaN(data.student_id)) {
      alert('学员ID必须填写且为数字');
      return Promise.reject(new Error('学员ID必须填写且为数字'));
    }
    if (!data.student_name) {
      alert('学员姓名不能为空');
      return Promise.reject(new Error('学员姓名不能为空'));
    }
    return axios.post('/students', data);
  },
  update: (id, data) => {
    if (!id) {
      alert('学员ID不能为空');
      return Promise.reject(new Error('学员ID不能为空'));
    }
    return axios.put(`/students/${id}`, data);
  },
  delete: (id) => {
    if (!id) {
      alert('学员ID不能为空');
      return Promise.reject(new Error('学员ID不能为空'));
    }
    return axios.delete(`/students/${id}`);
  },

  // 获取当前学生余额
  getBalance: () => axios.get('/students/me/balance'),

  // 学生充值
  recharge: (amount) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      alert('充值金额必须是数字');
      return Promise.reject(new Error('充值金额必须是数字'));
    }
    if (Number(amount) <= 0) {
      alert('充值金额必须大于0');
      return Promise.reject(new Error('充值金额必须大于0'));
    }
    return axios.post('/students/recharge', { amount: Number(amount) });
  }
};

// -------------------------- 课程报名API --------------------------
const enrollApi = {
  add: (data) => {
    if (!data.course_id || isNaN(data.course_id)) {
      alert('课程ID必须是数字');
      return Promise.reject(new Error('课程ID必须是数字'));
    }
    return axios.post('/enroll', data);
  },
  getList: (params = {}) => axios.get('/enroll', { params }),
  approve: (id, status) => {
    if (!id || !status) {
      alert('报名ID和审核状态不能为空');
      return Promise.reject(new Error('报名ID和审核状态不能为空'));
    }
    return axios.put(`/enroll/${id}/approve`, { status });
  },
  // 学生获取个人报名记录（增强边界处理）
  getMyEnrolls: () => {
    const user = userApi.getCurrentUser();
    if (!user) {
      alert('未获取到用户信息，请重新登录');
      return Promise.reject(new Error('未获取到用户信息'));
    }
    if (user.role !== 'student') {
      alert('当前用户非学生角色，无法获取报名记录');
      return Promise.reject(new Error('非学生角色'));
    }
    if (!user.relatedId) {
      alert('学生ID未配置，请联系管理员');
      return Promise.reject(new Error('学生ID未配置'));
    }
    return axios.get('/enroll', { params: { student_id: user.relatedId } });
  }
};

// -------------------------- 后端Express路由代码（保留，用于node app.js启动） --------------------------
if (typeof require !== 'undefined') { // 仅在Node环境执行后端代码
  const express = require('express');
  const router = express.Router();
  const sql = require('mssql');
  const { pool } = require('./config/db'); // 需确保后端config/db.js存在
  const { authenticateToken } = require('./middleware/authMiddleware'); // 需确保认证中间件存在

  // 教师获取自己的课程（后端接口）
  router.get('/courses/teacher', authenticateToken, async (req, res) => {
    try {
      if (req.user.role !== 'teacher') {
        return res.status(403).json({ success: false, message: '仅教师可访问' });
      }
      const teacherId = req.user.relatedId;
      if (isNaN(teacherId)) {
        return res.status(400).json({ success: false, message: '教师ID必须是数字' });
      }
      const result = await pool.request()
        .input('teacher_id', sql.Int, teacherId)
        .query(`
          SELECT 
            c.course_id, c.course_name, c.teacher_id, t.teacher_name,
            c.price, c.status, c.description, c.create_time
          FROM courses c
          LEFT JOIN teachers t ON c.teacher_id = t.teacher_id
          WHERE c.teacher_id = @teacher_id
          ORDER BY c.course_id ASC
        `);
      res.status(200).json({
        success: true,
        data: result.recordset,
        total: result.recordset.length
      });
    } catch (err) {
      console.error('教师获取课程失败：', err);
      res.status(500).json({
        success: false,
        message: '获取课程列表失败',
        error: err.message
      });
    }
  });

  // 所有课程接口（后端）
  router.get('/courses', authenticateToken, async (req, res) => {
    try {
      let query = `
        SELECT 
          c.course_id, c.course_name, c.teacher_id, ISNULL(t.teacher_name, '无') AS teacher_name,
          c.price, c.status, c.description, c.create_time
        FROM courses c
        LEFT JOIN teachers t ON c.teacher_id = t.teacher_id
      `;
      const request = pool.request();
      if (req.user.role === 'teacher') {
        if (isNaN(req.user.relatedId)) {
          return res.status(400).json({ success: false, message: '教师ID必须是数字' });
        }
        query += ` WHERE c.teacher_id = @teacher_id`;
        request.input('teacher_id', sql.Int, req.user.relatedId);
      }
      query += ` ORDER BY c.course_id ASC`;
      const result = await request.query(query);
      res.status(200).json({
        success: true,
        data: result.recordset,
        total: result.recordset.length
      });
    } catch (err) {
      console.error('获取课程列表失败：', err);
      res.status(500).json({
        success: false,
        message: '获取课程列表失败',
        error: err.message
      });
    }
  });

  // 导出后端路由（供app.js使用）
  module.exports = router;
}

// 导出所有前端API模块（挂载到window，页面可直接调用）
window.api = {
  auth: authApi,
  user: userApi,
  dashboard: dashboardApi,
  course: courseApi, // 关键：包含getTeacherCourses方法
  teacher: teacherApi,
  student: studentApi,
  enroll: enrollApi
};