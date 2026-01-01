// routes.js
// 管理员才能访问的接口
router.post('/courses', authMiddleware(['admin']), courseController.addCourse);
router.put('/courses/:id', authMiddleware(['admin']), courseController.updateCourse);
router.delete('/courses/:id', authMiddleware(['admin']), courseController.deleteCourse);

// 管理员和教师都能访问的接口
router.get('/courses', authMiddleware(['admin', 'teacher', 'student']), courseController.getCourses);

// 教师只能访问自己的课程
router.get('/teacher/courses', authMiddleware(['teacher']), courseController.getTeacherCourses);