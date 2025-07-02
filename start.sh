#!/bin/bash

# 3DPass区块监控系统启动脚本
# 优化内存设置，防止内存溢出

echo "🚀 启动3DPass区块监控系统（内存优化版）..."

# Node.js 内存和性能优化参数
NODE_OPTIONS="
--max-old-space-size=2048 \
--max-semi-space-size=128 \
--expose-gc \
--optimize-for-size \
--gc-interval=100
"

echo "📊 内存设置:"
echo "  最大堆内存: 2GB"
echo "  启用垃圾回收: 是"
echo "  优化模式: 内存优先"

# 检查配置文件
if [ ! -f "config.json" ]; then
    echo "⚠️ 配置文件不存在，从示例文件复制..."
    cp config-example.json config.json
fi

# 启动应用
echo "🔄 启动区块监控..."
export NODE_OPTIONS="$NODE_OPTIONS"
node block-monitor.js "$@" 