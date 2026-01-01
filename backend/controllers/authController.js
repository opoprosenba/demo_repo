// authController.js
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 查询用户
    const user = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (!user[0]) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }
    
    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user[0].password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }
    
    // 生成JWT令牌
    const token = jwt.sign(
      { 
        userId: user[0].user_id,
        username: user[0].username,
        role: user[0].role,
        relatedId: user[0].related_id
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    res.json({
      token,
      user: {
        userId: user[0].user_id,
        username: user[0].username,
        role: user[0].role,
        relatedId: user[0].related_id
      }
    });
  } catch (error) {
    res.status(500).json({ message: '登录失败', error: error.message });
  }
};