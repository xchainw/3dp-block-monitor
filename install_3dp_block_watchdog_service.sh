#!/bin/bash

# install 3dp block watchdog systemd service (Requires root privileges)

# modify here as needed
SERVICE_NAME="3dp.block.monitor"
WORK_PATH="$(pwd)"
SCRIPT_FILE="${WORK_PATH}/start_3dp_block_monitor.sh"

CONFIG_FILE="${WORK_PATH}/config.json"

# create start bot shell
if [ -e "$SCRIPT_FILE" ];then
    rm "$SCRIPT_FILE"
fi
cat << EOF > "$SCRIPT_FILE"
#!/bin/bash

node block-monitor --config $CONFIG_FILE
EOF
chmod +x "$SCRIPT_FILE"

# remove old service
if [ "0" != "$(ls /etc/systemd/system/ | grep $SERVICE_NAME | wc -l)" ];then
    ls /etc/systemd/system/ | grep $SERVICE_NAME | xargs sudo systemctl stop
    ls /etc/systemd/system/ | grep $SERVICE_NAME | xargs sudo systemctl disable
    rm -f /etc/systemd/system/$SERVICE_NAME.*
fi

# install new service
cat << EOF > "/etc/systemd/system/$SERVICE_NAME.service"
[Unit]
Description=3dp block monitor
After=network.target

[Service]
Type=simple
WorkingDirectory=$WORK_PATH
ExecStart=$SCRIPT_FILE
Restart=always
TimeoutSec=30
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl start "$SERVICE_NAME.service"
systemctl enable "$SERVICE_NAME.service"