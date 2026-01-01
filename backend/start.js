const { exec } = require('child_process');

console.log('开始启动后端服务...');

const child = exec('node app.js', {
  cwd: __dirname,
  env: process.env
});

child.stdout.on('data', (data) => {
  console.log('[stdout]', data.toString());
});

child.stderr.on('data', (data) => {
  console.log('[stderr]', data.toString());
});

child.on('close', (code) => {
  console.log(`[退出] 子进程退出码: ${code}`);
});

// 捕获未处理的异常
process.on('uncaughtException', (err) => {
  console.error('[未捕获异常]', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[未处理的Promise拒绝]', reason);
});