const { Web3 } = require("web3")

// 使用 Sepolia 测试网 RPC
const rpcUrl = "https://eth-sepolia.g.alchemy.com/v2/demo"
const web3 = new Web3(rpcUrl)

async function testWeb3() {
    try {
        console.log("🔗 连接到 Sepolia 测试网...\n")

        // 1. 获取网络信息
        const networkId = await web3.eth.net.getId()
        console.log("📡 网络 ID:", networkId)

        // 2. 获取最新区块号
        const blockNumber = await web3.eth.getBlockNumber()
        console.log("🔢 最新区块号:", blockNumber)

        // 3. 获取 gas 价格
        const gasPrice = await web3.eth.getGasPrice()
        console.log("⛽ Gas 价格:", web3.utils.fromWei(gasPrice, "gwei"), "Gwei")

        // 4. 获取区块信息
        const block = await web3.eth.getBlock(blockNumber)
        console.log("📦 区块时间戳:", new Date(block.timestamp * 1000).toLocaleString())
        console.log("🔄 区块交易数:", block.transactions.length)

        // 5. 创建一个测试账户
        const testAccount = web3.eth.accounts.create()
        console.log("\n👤 创建的测试账户:")
        console.log("   地址:", testAccount.address)
        console.log("   私钥:", testAccount.privateKey)

        // 6. 查询一个已知地址的余额（Sepolia 水龙头地址）
        const faucetAddress = "0x6eD74F5b2b9E18559eB5797f2c2D6f8c8e5C9494"
        const balance = await web3.eth.getBalance(faucetAddress)
        console.log("\n💰 Sepolia 水龙头余额:", web3.utils.fromWei(balance, "ether"), "ETH")

        // 7. 检查节点是否同步
        const isSyncing = await web3.eth.isSyncing()
        console.log("\n🔄 节点同步状态:", isSyncing === false ? "已同步" : "同步中")
    } catch (error) {
        console.error("❌ 错误:", error.message)
    }
}

// 运行测试
testWeb3()
