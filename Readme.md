# 培训机构课程管理系统
一个基于 Web 的培训机构课程管理系统，提供完整的课程、学生、教师、班级、教学计划等管理功能，采用现代化 UI 设计和响应式布局。

## 功能特性

- 用户认证与权限管理（管理员/教师/学员三种角色）
- 课程管理（增删改查、状态管理）
- 讲师管理（讲师信息维护）
- 学员管理（学员信息、余额管理）
- 报名管理（报名审核、缴费管理）
- 用户管理（用户创建、状态控制）
- 仪表盘统计（数据可视化）
- JWT Token 认证
- 密码加密存储（bcrypt）

## 技术栈

### 后端
- Node.js
- Express.js
- Microsoft SQL Server
- JWT (JSON Web Token)
- bcrypt (密码加密)
- CORS (跨域支持)

### 前端
- 原生 HTML/CSS/JavaScript
- Tailwind CSS (样式框架)
- Axios (HTTP 客户端)
- Font Awesome (图标库)

## 项目结构

```
training-course-manager/
├── backend/                    # 后端目录
│   ├── config/                # 配置文件
│   │   └── config.js         # 主配置
│   ├── controllers/          # 控制器
│   │   ├── authController.js
│   │   ├── courseController.js
│   │   └── userController.js
│   ├── middlewares/          # 中间件
│   │   ├── authMiddleware.js
│   │   └── errorMiddleware.js
│   ├── routes/               # 路由
│   │   ├── authRoutes.js
│   │   └── courseRoutes.js
│   ├── app.js                # Express 应用
│   ├── db.js                 # 数据库连接
│   ├── server.js             # 服务器启动
│   └── .env                  # 环境变量
├── frontend/                  # 前端目录
│   ├── static/
│   │   ├── js/
│   │   │   └── api.js        # API 封装
│   │   └── lib/              # 第三方库
│   │       ├── axios/
│   │       └── font-awesome/
│   ├── index.html            # 主页
│   └── login.html            # 登录页
└── README.md                 # 项目说明
```

## 快速开始

### 环境要求

- Node.js >= 14.x
- Microsoft SQL Server
- npm 或 yarn

### 安装步骤

1. 克隆项目
```bash
git clone <repository-url>
cd training-course-manager
```

2. 安装后端依赖
```bash
cd backend
npm install
```

3. 配置环境变量

在 `backend/.env` 文件中配置数据库连接：

```env
DB_SERVER=localhost
DB_USER=px
DB_PASSWORD=123456
DB_NAME=training_db
DB_PORT=1433
API_PORT=3000
JWT_SECRET=your-secret-key-keep-it-safe
```

4. 启动后端服务
```bash
npm start
# 或使用开发模式（自动重启）
npm run dev
```

后端服务将在 `http://localhost:3000` 启动

5. 启动前端服务

前端是纯静态应用，可以直接在浏览器中打开 `frontend/index.html`，或使用本地服务器：

```bash
cd frontend
npm install
npm start
```

前端服务将在 `http://localhost:8080` 启动

## 数据库配置

### 创建数据库

在 SQL Server 中创建数据库：

```sql
CREATE DATABASE training_db;
```

### 数据表结构

系统会自动创建以下数据表：
- `users` - 用户表
- `courses` - 课程表
- `teachers` - 讲师表
- `students` - 学员表
- `enroll` - 报名表

### 初始化测试数据

登录管理员账号后，可以通过以下接口重置测试数据：

```bash
POST /api/users/reset-test-data
```

## 默认测试账号

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 管理员 | 000 | 123456 | 拥有所有权限 |
| 教师 | 101 | 123456 | 可管理自己的课程 |
| 学员 | 201 | 123456 | 可查看课程和报名 |

## API 接口文档

### 认证接口

- `POST /api/auth/login` - 用户登录
- `GET /api/auth/verify` - 验证 Token
- `POST /api/auth/logout` - 退出登录

### 用户管理

- `GET /api/users` - 获取用户列表（管理员）
- `POST /api/users` - 新增用户（管理员）
- `PUT /api/users/:id/status` - 修改用户状态（管理员）
- `POST /api/users/reset-test-data` - 重置测试数据（管理员）

### 课程管理

- `GET /api/courses` - 获取课程列表
- `POST /api/courses` - 创建课程（管理员/教师）
- `PUT /api/courses/:id` - 更新课程（管理员/教师）
- `DELETE /api/courses/:id` - 删除课程（管理员）

### 学员管理

- `GET /api/students` - 获取学员列表
- `POST /api/students` - 新增学员（管理员）
- `PUT /api/students/:id` - 更新学员信息（管理员）
- `DELETE /api/students/:id` - 删除学员（管理员）

### 报名管理

- `GET /api/enroll` - 获取报名列表
- `POST /api/enroll` - 学员报名课程
- `PUT /api/enroll/:id/approve` - 审核报名（管理员）

### 仪表盘

- `GET /api/dashboard` - 获取统计数据

## 权限说明

| 功能 | 管理员 | 教师 | 学员 |
|------|--------|------|------|
| 用户管理 | ✓ | ✗ | ✗ |
| 课程管理 | ✓ | 自己的课程 | ✗ |
| 讲师管理 | ✓ | ✗ | ✗ |
| 学员管理 | ✓ | ✗ | 仅查看自己 |
| 报名管理 | ✓ | 查看 | 仅查看自己 |
| 仪表盘 | ✓ | ✓ | ✓ |

## 开发说明

### 后端开发

- 使用 `npm run dev` 启动开发服务器（支持热重载）
- API 日志会在控制台输出
- 错误信息会返回详细的堆栈信息（开发环境）

### 前端开发

- 前端使用原生 JavaScript，无需构建工具
- API 请求封装在 `frontend/static/js/api.js`
- 修改 API 地址请编辑 `api.js` 中的 `API_BASE_URL`

### 数据库调试

可以使用以下脚本进行数据库调试：

```bash
# 检查数据库连接
node backend/check_db.js

# 检查课程数据
node backend/check_course.js

# 获取用户列表
node backend/get_users.js
```

## 常见问题

### 1. 数据库连接失败

请检查：
- SQL Server 服务是否启动
- `.env` 文件中的数据库配置是否正确
- 防火墙是否允许连接

### 2. 跨域问题

后端已配置 CORS，允许以下来源：
- `http://localhost:3000`
- `http://localhost:8080`
- `http://127.0.0.1:3000`
- `http://127.0.0.1:8080`

### 3. Token 过期

Token 有效期为 2 小时，过期后需要重新登录。

## 部署说明

### 生产环境配置

1. 修改 `.env` 文件中的配置：
```env
NODE_ENV=production
JWT_SECRET=<使用强密码>
```

2. 使用 PM2 管理进程：
```bash
npm install -g pm2
pm2 start backend/app.js --name "training-api"
```

3. 使用 Nginx 反向代理：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        root /path/to/frontend;
        try_files $uri $uri/ /index.html;
    }
}
```

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

ISC

## 联系方式

2654586697@qq.com
