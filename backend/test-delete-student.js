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

async function deleteStudent(token, studentId) {
    try {
        const response = await axios.delete(`${BASE_URL}/students/${studentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('删除学员失败:', error.response?.data || error.message);
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

async function runTest() {
    try {
        console.log('=== 学员删除功能测试 ===');
        
        // 1. 登录获取token
        console.log('1. 管理员登录...');
        const token = await login();
        console.log('✓ 登录成功，获取到token');
        
        // 2. 获取初始学员列表
        console.log('\n2. 获取初始学员列表...');
        const initialStudents = await getStudents(token);
        console.log(`✓ 初始学员数量: ${initialStudents.length}`);
        console.log('初始学员列表:', initialStudents);
        
        // 如果没有学员，退出测试
        if (initialStudents.length === 0) {
            console.log('\n❌ 没有可删除的学员，测试结束');
            return;
        }
        
        // 选择第一个学员进行删除
        const studentToDelete = initialStudents[0];
        const studentId = studentToDelete.student_id;
        
        // 3. 删除学员
        console.log(`\n3. 删除学员 (ID: ${studentId})...`);
        const deleteResult = await deleteStudent(token, studentId);
        console.log('✓ 删除操作结果:', deleteResult);
        
        // 4. 验证学员是否被删除
        console.log('\n4. 验证学员是否被删除...');
        const updatedStudents = await getStudents(token);
        const deletedStudent = updatedStudents.find(s => s.student_id === studentId);
        
        if (!deletedStudent) {
            console.log('✓ 学员已从学员列表中删除');
        } else {
            console.log('❌ 学员仍在学员列表中');
        }
        
        // 5. 验证用户账号是否被删除
        console.log('\n5. 验证用户账号是否被删除...');
        const users = await getUsers(token);
        const deletedUser = users.find(u => u.role === 'student' && u.related_id === studentId);
        
        if (!deletedUser) {
            console.log('✓ 用户账号已从用户列表中删除');
        } else {
            console.log('❌ 用户账号仍在用户列表中');
        }
        
        console.log('\n=== 测试完成 ===');
        
        if (!deletedStudent && !deletedUser) {
            console.log('🎉 学员删除功能测试通过！');
        } else {
            console.log('❌ 学员删除功能测试失败！');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        process.exit(1);
    }
}

runTest();