const https = require('https');
const http = require('http');

// 登录获取token
async function login() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.success && result.token) {
            resolve(result.token);
          } else {
            reject(new Error('Login failed: ' + result.message));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify({ username: '000', password: '123456' }));
    req.end();
  });
}

// 测试获取学员列表API
async function testGetStudents() {
  try {
    const token = await login();
    console.log('✅ 登录成功，获取到Token');

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/students',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      };

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve({ statusCode: res.statusCode, result });
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  } catch (error) {
    console.error('❌ 登录失败:', error.message);
    throw error;
  }
}

// 执行测试
async function runTest() {
  console.log('🔍 测试学员列表API...');
  try {
    const { statusCode, result } = await testGetStudents();
    
    if (statusCode === 200 && result.success) {
      console.log('✅ 学员列表API测试成功！');
      console.log('📊 返回学员数量:', result.data.length);
      console.log('📋 前3名学员信息:');
      
      // 格式化输出前3名学员
      result.data.slice(0, 3).forEach((student, index) => {
        console.log(`\n学员${index + 1}:`);
        console.log(`  ID: ${student.student_id}`);
        console.log(`  姓名: ${student.student_name}`);
        console.log(`  课程: ${student.course_name || '无'}`);
      });
    } else {
      console.log('❌ 学员列表API测试失败:', `状态码: ${statusCode}`, `错误: ${result.message}`);
    }
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

runTest();
