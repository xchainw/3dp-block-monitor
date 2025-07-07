module.exports = {
  apps: [
    {
      name: '3dp-block-monitor-app',
      script: 'block-monitor.js',
      node_args: '--max-old-space-size=2048 --expose-gc',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/app-error.log',
      out_file: './logs/app-out.log',
      log_file: './logs/app-combined.log',
      time: true,
      merge_logs: true,
      kill_timeout: 30000,
      listen_timeout: 10000,
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: '3dp-block-monitor-web',
      script: 'web-server.js',
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
      merge_logs: true,
      kill_timeout: 10000,
      listen_timeout: 5000,
      restart_delay: 2000,
      max_restarts: 10,
      min_uptime: '5s'
    }
  ]
}; 