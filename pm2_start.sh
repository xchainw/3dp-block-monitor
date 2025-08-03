#!/bin/bash

# echo "Starting 3dp-block-monitor-app"
# pm2 start npm --name "3dp-block-monitor-app" -- start

# echo "Starting 3dp-block-monitor-web"
# pm2 start npm --name "3dp-block-monitor-web" -- run web

# use ecosystem.config.js to start
pm2 start ecosystem.config.js