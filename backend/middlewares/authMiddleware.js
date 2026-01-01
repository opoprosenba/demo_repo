// authMiddleware.js
const authMiddleware = (roles = []) => {
  return (req, res, next) => {
    try {
      // 从请求头获取token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: '未授权访问' });
      }
      
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // 检查角色权限
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ message: '没有访问权限' });
      }
      
      // 将用户信息添加到请求对象
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: '令牌无效或已过期' });
    }
  };
};