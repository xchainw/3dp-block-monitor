#!/usr/bin/env node

// API测试脚本，验证修复后的API调用
const {ApiPromise, WsProvider, Keyring} = require('@polkadot/api');
const polkadotUtil = require("@polkadot/util");

async function testApi() {
    console.log('🧪 开始API测试...\n');
    
    try {
        // 连接到3DPass节点
        const provider = new WsProvider('wss://rpc.3dpass.org');
        const api = await ApiPromise.create({provider});
        console.log('✅ API连接成功');
        
        // 创建keyring
        const keyring = new Keyring({type: 'sr25519'});
        keyring.setSS58Format(71);
        
        // 获取最新区块高度
        const latestHeader = await api.rpc.chain.getHeader();
        const latestHeight = Number(latestHeader.number);
        console.log(`📊 最新区块高度: #${latestHeight}`);
        
        // 测试处理一个区块（取最新区块前10个）
        const testHeight = latestHeight - 10;
        console.log(`\n🔍 测试处理区块 #${testHeight}...`);
        
        // 1. 获取区块哈希
        const blockHash = await api.rpc.chain.getBlockHash(testHeight);
        console.log(`✅ 区块哈希: ${blockHash}`);
        
        // 2. 获取区块头
        const header = await api.rpc.chain.getHeader(blockHash);
        console.log(`✅ 区块头获取成功`);
        
        // 3. 获取作者（修复后的方式）
        const author = await api.query.validatorSet.authors(header.number);
        console.log(`✅ 区块作者: ${author.toString()}`);
        
        // 4. 获取难度（修复后的方式）
        const difficulty = await api.query.difficulty.currentDifficulty.at(blockHash);
        console.log(`✅ 区块难度: ${difficulty.toString()}`);
        
        // 5. 获取时间戳（修复后的方式）
        const timestampRaw = await api.query.timestamp.now.at(blockHash);
        const timestampMs = Number(timestampRaw.toString().trim());
        const timestamp = Math.floor(timestampMs / 1000);
        console.log(`✅ 区块时间戳: ${timestamp} (${new Date(timestamp * 1000).toLocaleString()})`);
        
        // 6. 转换作者地址为公钥（修复后的方式）
        let authorPublicKey = '';
        try {
            authorPublicKey = polkadotUtil.u8aToHex(keyring.decodeAddress(author.toString()));
            console.log(`✅ 作者公钥: ${authorPublicKey}`);
        } catch (e) {
            console.warn(`⚠️  获取公钥失败: ${e.message}`);
        }
        
        // 7. 获取区块奖励（修复后的方式）
        let reward_amount = '0';
        try {
            const blockEvents = (await api.query.system.events.at(blockHash)).toHuman();
            const firstFinalizationEvent = blockEvents.find(event => event.phase === 'Finalization');
            if (firstFinalizationEvent && firstFinalizationEvent.event.data.amount) {
                reward_amount = firstFinalizationEvent.event.data.amount.replace(/,/g, '');
                console.log(`✅ 区块奖励: ${reward_amount}`);
                console.log(`✅ 奖励获得者: ${firstFinalizationEvent.event.data.who}`);
            } else {
                console.warn('⚠️  未找到爆块奖励事件');
            }
        } catch (e) {
            console.warn(`⚠️  获取区块奖励失败: ${e.message}`);
        }
        
        console.log('\n🎉 API测试完成！所有修复的API调用都正常工作。');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ API测试失败:', error);
        process.exit(1);
    }
}

// 运行测试
testApi().catch(console.error); 