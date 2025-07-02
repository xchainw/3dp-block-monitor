#!/usr/bin/env node

/**
 * 3DPass区块数据补漏工具
 * 用于检查和修复数据库中缺失的区块数据
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🔧 3DPass区块数据补漏工具');
console.log('==========================================');

const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('📋 使用方法:');
    console.log('  检查并修复所有缺失数据:');
    console.log('    node fix-missing-blocks.js check');
    console.log('');
    console.log('  手动补漏指定范围:');
    console.log('    node fix-missing-blocks.js range 15095-15250');
    console.log('');
    console.log('  显示帮助:');
    console.log('    node fix-missing-blocks.js help');
    process.exit(0);
}

const command = args[0];

switch (command) {
    case 'check':
        console.log('🔍 启动完整性检查和自动补漏...');
        runBlockMonitor(['--check-integrity']);
        break;
        
    case 'range':
        if (args.length < 2) {
            console.error('❌ 请指定区块范围，例如: node fix-missing-blocks.js range 15095-15250');
            process.exit(1);
        }
        console.log(`🔧 启动指定范围补漏: ${args[1]}`);
        runBlockMonitor(['--fill-range', args[1]]);
        break;
        
    case 'help':
        console.log('📋 详细使用说明:');
        console.log('');
        console.log('1. 检查完整性并自动补漏:');
        console.log('   node fix-missing-blocks.js check');
        console.log('   - 扫描整个数据库，找出所有缺失的区块');
        console.log('   - 自动补漏所有缺失的区块数据');
        console.log('');
        console.log('2. 手动补漏指定范围:');
        console.log('   node fix-missing-blocks.js range 开始区块-结束区块');
        console.log('   - 例如: node fix-missing-blocks.js range 15095-15250');
        console.log('   - 强制补漏指定范围内的所有区块');
        console.log('');
        console.log('3. 查找缺失区块的SQL查询:');
        console.log('   WITH RECURSIVE all_ids(id) AS (');
        console.log('     SELECT 1');
        console.log('     UNION ALL');
        console.log('     SELECT id + 1 FROM all_ids WHERE id < (SELECT max(id) FROM p3d_block_info)');
        console.log('   )');
        console.log('   SELECT id FROM all_ids WHERE id NOT IN (SELECT id FROM p3d_block_info);');
        break;
        
    default:
        console.error(`❌ 未知命令: ${command}`);
        console.log('使用 "node fix-missing-blocks.js help" 查看帮助');
        process.exit(1);
}

function runBlockMonitor(additionalArgs) {
    const scriptPath = path.join(__dirname, 'block-monitor.js');
    const child = spawn('node', [scriptPath, ...additionalArgs], {
        stdio: 'inherit'
    });
    
    child.on('error', (error) => {
        console.error('❌ 启动失败:', error);
        process.exit(1);
    });
    
    child.on('exit', (code) => {
        if (code === 0) {
            console.log('✅ 补漏完成');
        } else {
            console.error(`❌ 程序异常退出，退出码: ${code}`);
        }
        process.exit(code);
    });
} 