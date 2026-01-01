const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';
const ADMIN_USERNAME = '000';
const ADMIN_PASSWORD = '123456';

async function login() {
    try {
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            username: ADMIN_USERNAME,
            password: ADMIN_PASSWORD
        });
        return response.data.token;
    } catch (error) {
        console.error('登录失败:', error.response?.data || error.message);
        throw error;
    }
}

async function addStudent(token, studentData) {
    try {
        const response = await axios.post(`${BASE_URL}/students`, studentData, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('新增学员失败:', error.response?.data || error.message);
        throw error;
    }
}

async function getStudents(token) {
    try {
        const response = await axios.get(`${BASE_URL}/students`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data.data;
    } catch (error) {
        console.error('获取学员列表失败:', error.response?.data || error.message);
        throw error;
    }
}

async function getUsers(token) {
    try {
        const response = await axios.get(`${BASE_URL}/users`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data.data;
    } catch (error) {
        console.error('获取用户列表失败:', error.response?.data || error.message);
        throw error;
    }
}

async function studentLogin(studentId) {
    try {
        const response = await axios.post(`${BASE_URL}/auth/login`, {
            username: studentId.toString(),
            password: '123456'
        });
        return response.data;
    } catch (error) {
        console.error('学员登录失败:', error.response?.data || error.message);
        throw error;
    }
}

async function runTest() {
    try {
        console.log('=== 新增学生功能测试 ===');
        
        // 1. 管理员登录
        console.log('1. 管理员登录...');
        const token = await login();
        console.log('✓ 登录成功，获取到token');
        
        // 2. 生成新学员ID
        const newStudentId = Math.floor(1000 + Math.random() * 9000); // 生成4位随机ID
        const newStudent = {
            student_id: newStudentId,
            student_name: `测试学员${newStudentId}`,
            gender: '男',
            phone: '13800138000'
        };
        
        // 3. 新增学员
        console.log(`\n2. 新增学员 (ID: ${newStudentId})...`);
        const addResult = await addStudent(token, newStudent);
        console.log('✓ 新增学员结果:', addResult);
        
        // 4. 验证学员是否存在
        console.log('\n3. 验证学员是否存在...');
        const students = await getStudents(token);
        const addedStudent = students.find(s => s.student_id === newStudentId);
        
        if (addedStudent) {
            console.log('✓ 学员已成功添加到学员列表');
            console.log('学员信息:', addedStudent);
        } else {
            console.log('❌ 学员未添加到学员列表');
            return;
        }
        
        // 5. 验证用户账号是否存在
        console.log('\n4. 验证用户账号是否存在...');
        const users = await getUsers(token);
        const addedUser = users.find(u => u.username === newStudentId.toString() && u.role === 'student');
        
        if (addedUser) {
            console.log('✓ 用户账号已成功创建');
            console.log('用户账号信息:', addedUser);
        } else {
            console.log('❌ 用户账号未创建');
            return;
        }
        
        // 6. 测试学员登录
        console.log('\n5. 测试学员登录...');
        const loginResult = await studentLogin(newStudentId);
        console.log('✓ 学员登录成功！');
        console.log('登录结果:', loginResult);
        
        console.log('\n=== 测试完成 ===');
        console.log('🎉 新增学生功能测试通过！');
        console.log(`- 新增学员ID: ${newStudentId}`);
        console.log(`- 学生账号: ${newStudentId}`);
        console.log(`- 默认密码: 123456`);
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        process.exit(1);
    }
}

runTest();