// 课程实体
package com.training.model.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "course")
public class Course {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private String courseCode;
    
    @Column(nullable = false)
    private String name;
    
    private String description;
    
    @Column(name = "course_type")
    private String type;
    
    @Column(name = "difficulty_level")
    private String difficultyLevel;
    
    private Integer duration; // 课时
    
    private BigDecimal price;
    
    private String status; // 状态：启用/禁用
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

// 学员实体
package com.training.model.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "student")
public class Student {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private String studentCode;
    
    @Column(nullable = false)
    private String name;
    
    private String gender;
    
    private String phone;
    
    private String email;
    
    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;
    
    private String address;
    
    @Column(name = "registration_date")
    private LocalDateTime registrationDate;
    
    private String status; // 状态：在读/毕业/退学
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        studentCode = "STD" + System.currentTimeMillis();
        registrationDate = LocalDateTime.now();
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

// 教师实体
package com.training.model.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "teacher")
public class Teacher {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private String teacherCode;
    
    @Column(nullable = false)
    private String name;
    
    private String gender;
    
    private String phone;
    
    private String email;
    
    @Column(name = "department_id")
    private Long departmentId;
    
    private String title; // 职称
    
    @Column(name = "hire_date")
    private LocalDate hireDate;
    
    private String status; // 状态：在职/离职
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        teacherCode = "TCH" + System.currentTimeMillis();
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

// 班级实体
package com.training.model.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "class")
public class Class {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private String classCode;
    
    @Column(nullable = false)
    private String name;
    
    @Column(name = "course_id")
    private Long courseId;
    
    @Column(name = "teacher_id")
    private Long teacherId;
    
    @Column(name = "start_date")
    private LocalDate startDate;
    
    @Column(name = "end_date")
    private LocalDate endDate;
    
    private Integer capacity; // 容量
    
    @Column(name = "current_count")
    private Integer currentCount; // 当前人数
    
    private String status; // 状态：未开课/进行中/已结课
    
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        classCode = "CLS" + System.currentTimeMillis();
        currentCount = 0;
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
public class Application {
    public static void main(String[] args) {
        // 这里可以添加程序启动的逻辑，如 Spring Boot 应用的启动代码
        System.out.println("程序启动成功");
    }
}