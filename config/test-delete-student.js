const axios = require('axios');

// 配置axios
axios.defaults.baseURL = 'http://localhost:3001/api';

async function testDeleteStudent() {
  try {
    // 1. 登录获取token
    console.log('正在登录...');
    const loginResponse = await axios.post('/auth/login', {
      username: '000',
      password: '123456'
    });
    
    if (!loginResponse.data.success) {
      console.error('登录失败:', loginResponse.data.message);
      return;
    }
    
    const token = loginResponse.data.token;
    console.log('登录成功，token:', token);
    
    // 2. 设置请求头
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // 3. 获取学员列表
    console.log('\n正在获取学员列表...');
    const studentsResponse = await axios.get('/students');
    console.log('学员列表:', studentsResponse.data.data);
    
    // 4. 选择一个学员进行删除（这里选择ID最小的学员）
    if (studentsResponse.data.data.length === 0) {
      console.error('没有学员可以删除');
      return;
    }
    
    const studentToDelete = studentsResponse.data.data[0];
    const studentId = studentToDelete.student_id;
    
    console.log(`\n准备删除学员: ID=${studentId}, 姓名=${studentToDelete.student_name}`);
    
    // 5. 执行删除
    const deleteResponse = await axios.delete(`/students/${studentId}`);
    console.log('删除结果:', deleteResponse.data);
    
    // 6. 再次获取学员列表，验证是否删除成功
    console.log('\n再次获取学员列表，验证删除结果...');
    const updatedStudentsResponse = await axios.get('/students');
    console.log('更新后的学员列表:', updatedStudentsResponse.data.data);
    
    // 7. 检查用户列表，验证用户账号是否也被删除
    console.log('\n正在获取用户列表...');
    const usersResponse = await axios.get('/users');
    console.log('用户列表:', usersResponse.data.data);
    
  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
  }
}

testDeleteStudent();
