const axios = require('axios');

// 测试新增课程205
async function testAddCourse205() {
  try {
    // 首先登录获取Token
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      username: '000',
      password: '123456'
    });
    
    const token = loginResponse.data.token;
    console.log('登录成功，获取到Token:', token.substring(0, 20) + '...');
    
    // 测试新增课程205
    const courseData = {
      course_id: 205,
      course_name: 'Web前端开发',
      teacher_id: 101,
      price: 1999.00,
      status: '未开始',
      description: '测试课程，验证软删除恢复功能'
    };
    
    console.log('\n测试新增课程205:', courseData);
    const courseResponse = await axios.post('http://localhost:3000/api/courses', courseData, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('\n新增课程成功:', courseResponse.data);
    
    // 验证课程是否被正确恢复
    const getCoursesResponse = await axios.get('http://localhost:3000/api/courses', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const course205 = getCoursesResponse.data.data.find(course => course.course_id === 205);
    if (course205) {
      console.log('\n验证课程205已恢复:', {
        course_id: course205.course_id,
        course_name: course205.course_name,
        status: course205.status
      });
    } else {
      console.log('\n未找到课程205');
    }
    
  } catch (error) {
    console.error('\n测试失败:', error.response ? error.response.data : error.message);
  }
}

// 运行测试
testAddCourse205();