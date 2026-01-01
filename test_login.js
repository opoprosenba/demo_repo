const axios = require('axios');

// 测试不同角色的用户登录
const testUsers = [
  { username: '000', password: '123456', role: 'admin', expected: true },  // 管理员
  { username: '101', password: '123456', role: 'teacher', expected: true }, // 教师（原用户）
  { username: '102', password: '123456', role: 'teacher', expected: true }, // 教师（新创建）
  { username: '103', password: '123456', role: 'teacher', expected: true }, // 教师（新创建）
  { username: '301', password: '123456', role: 'student', expected: true }, // 学生（原用户）
  { username: '302', password: '123456', role: 'student', expected: true }, // 学生（新创建）
  { username: '303', password: '123456', role: 'student', expected: true }, // 学生（新创建）
  { username: '999', password: '123456', role: 'nonexistent', expected: false }, // 不存在的用户
  { username: '000', password: 'wrong', role: 'admin', expected: false } // 错误的密码
];

async function testLogin() {
  console.log('=== 开始测试登录功能 ===\n');
  
  for (const testUser of testUsers) {
    console.log(`测试用户: ${testUser.username} (${testUser.role})`);
    console.log(`密码: ${testUser.password}`);
    
    try {
      const response = await axios.post('http://localhost:3000/api/auth/login', {
        username: testUser.username,
        password: testUser.password
      });
      
      if (response.data.success) {
        console.log(`✅ 登录成功`);
        console.log(`   角色: ${response.data.user.role}`);
        console.log(`   Token: ${response.data.token.substring(0, 20)}...`);
        
        if (testUser.expected) {
          console.log('   ✅ 符合预期');
        } else {
          console.log('   ❌ 不符合预期（应该失败）');
        }
      } else {
        console.log(`❌ 登录失败: ${response.data.message}`);
        
        if (!testUser.expected) {
          console.log('   ✅ 符合预期');
        } else {
          console.log('   ❌ 不符合预期（应该成功）');
        }
      }
    } catch (error) {
      if (error.response) {
        console.log(`❌ 登录失败: ${error.response.status} - ${error.response.data.message}`);
      } else {
        console.log(`❌ 请求失败: ${error.message}`);
      }
      
      if (!testUser.expected) {
        console.log('   ✅ 符合预期');
      } else {
        console.log('   ❌ 不符合预期（应该成功）');
      }
    }
    
    console.log('');
  }
  
  console.log('=== 测试完成 ===');
}

testLogin().catch(err => console.error(err));
