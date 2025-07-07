module.exports = {
  apps: [
    {
      name: '3dp-block-monitor-app',
      script: 'npm',
      args: 'start',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=2048'
      },
      error_file: './logs/app-error.log',
      out_file: './logs/app-out.log',
      log_file: './logs/app-combined.log',
      time: true,
      // 优雅关闭配置
      kill_timeout: 30000,  // 30秒关闭超时
      listen_timeout: 10000, // 10秒启动超时
      // 重启策略
      restart_delay: 5000,   // 重启延迟5秒
      max_restarts: 10,      // 最大重启次数
      min_uptime: '10s'      // 最小运行时间
    },
    {
      name: '3dp-block-monitor-web',
      script: 'npm',
      args: 'run web',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 9070
      },
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_file: './logs/web-combined.log',
      time: true,
      // 优雅关闭配置
      kill_timeout: 10000,   // 10秒关闭超时
      listen_timeout: 5000,  // 5秒启动超时
      // 重启策略
      restart_delay: 2000,   // 重启延迟2秒
      max_restarts: 10,      // 最大重启次数
      min_uptime: '5s'       // 最小运行时间
    }
  ]
}; 