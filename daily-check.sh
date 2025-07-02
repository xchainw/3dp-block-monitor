#!/bin/bash

# 3DPass区块数据每日完整性检查脚本
# 用于预防性维护，确保数据完整性

# 脚本配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/check.log"
CONFIG_FILE="$SCRIPT_DIR/config.json"

# 日志记录函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 错误处理函数
handle_error() {
    log "❌ 错误: $1"
    
    # 可选：发送邮件通知（需要配置mailutils）
    # echo "3DPass数据监控发现问题: $1" | mail -s "3DPass数据监控告警" admin@domain.com
    
    exit 1
}

# 检查工作目录
cd "$SCRIPT_DIR" || handle_error "无法切换到脚本目录: $SCRIPT_DIR"

log "🔍 开始每日数据完整性检查..."
log "📂 工作目录: $SCRIPT_DIR"

# 检查配置文件是否存在
if [ ! -f "$CONFIG_FILE" ]; then
    handle_error "配置文件不存在: $CONFIG_FILE"
fi

# 检查Node.js是否可用
if ! command -v node >&1; then
    handle_error "Node.js 未安装或不在PATH中"
fi

# 执行完整性检查
log "🔧 运行数据完整性检查和自动补漏..."

# 使用便捷工具进行检查
if node fix-missing-blocks.js check >> "$LOG_FILE" 2>&1; then
    log "✅ 数据完整性检查完成"
    
    # 获取数据库统计信息
    if command -v sqlite3 >&1; then
        DB_PATH=$(node -e "
            try {
                const config = require('./config.json');
                console.log(config.database?.path || './3dp_blocks.db');
            } catch(e) {
                console.log('./3dp_blocks.db');
            }
        ")
        
        if [ -f "$DB_PATH" ]; then
            log "📊 数据库统计信息:"
            sqlite3 "$DB_PATH" "
                SELECT 
                    '  📦 总区块数: ' || COUNT(*) as info
                FROM p3d_block_info
                UNION ALL
                SELECT 
                    '  📈 最大高度: #' || MAX(id) as info
                FROM p3d_block_info
                UNION ALL
                SELECT 
                    '  📅 最新时间: ' || datetime(MAX(timestamp), 'unixepoch', 'localtime') as info
                FROM p3d_block_info;
            " 2>/dev/null | while read line; do
                log "$line"
            done
        fi
    fi
    
    log "🎯 每日检查成功完成"
    
else
    handle_error "数据完整性检查失败，请查看详细日志"
fi

# 日志文件大小控制（保留最近1000行）
if [ -f "$LOG_FILE" ]; then
    tail -n 1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi

log "✅ 每日检查脚本执行完毕" 