module.exports = {
  "apps": [
    {
      "name": "3dp-block-monitor-app",
      "script": "block-monitor.js",
      "node_args": "--max-old-space-size=160 --expose-gc --optimize-for-size --gc-interval=100",
      "cwd": "./",
      "instances": 1,
      "autorestart": true,
      "watch": false,
      "max_memory_restart": "200M",
      "env": {
        "NODE_ENV": "production",
        "NODE_OPTIONS": "--max-old-space-size=160 --expose-gc --optimize-for-size --gc-interval=100",
        "MEMORY_CONFIG": "{\"maxMemoryMB\":200,\"maxOldSpaceSize\":512,\"gcThreshold\":0.7,\"restartThreshold\":0.9,\"checkInterval\":30000,\"maxRestarts\":20,\"nodeArgs\":\"--max-old-space-size=512 --expose-gc --optimize-for-size --gc-interval=100\"}"
      },
      "time": true,
      "merge_logs": true,
      "kill_timeout": 30000,
      "listen_timeout": 10000,
      "restart_delay": 5000,
      "max_restarts": 20,
      "min_uptime": "10s",
      "monitoring": true,
      "memory_threshold": "180M"
    },
    {
      "name": "3dp-block-monitor-web",
      "script": "web-server.js",
      "node_args": "--max-old-space-size=80 --expose-gc --optimize-for-size",
      "cwd": "./",
      "instances": 1,
      "autorestart": true,
      "watch": false,
      "max_memory_restart": "100M",
      "env": {
        "NODE_ENV": "production",
        "PORT": 9070,
        "NODE_OPTIONS": "--max-old-space-size=80 --expose-gc --optimize-for-size",
        "MEMORY_CONFIG": "{\"maxMemoryMB\":100,\"maxOldSpaceSize\":256,\"gcThreshold\":0.7,\"restartThreshold\":0.9,\"checkInterval\":60000,\"maxRestarts\":20,\"nodeArgs\":\"--max-old-space-size=256 --expose-gc --optimize-for-size\"}"
      },
      "time": true,
      "merge_logs": true,
      "kill_timeout": 10000,
      "listen_timeout": 5000,
      "restart_delay": 2000,
      "max_restarts": 20,
      "min_uptime": "5s",
      "monitoring": true,
      "memory_threshold": "80M"
    }
  ]
};