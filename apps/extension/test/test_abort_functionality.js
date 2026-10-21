/**
 * 测试 AbortController 功能的简单示例
 * 这个文件用于验证我们的实现是否正确
 */

// 模拟 ImmersiveTranslator 的使用场景
async function testAbortFunctionality() {
    console.log("开始测试 AbortController 功能...");
    
    // 模拟多个并发请求
    const controllers = [];
    const promises = [];
    
    // 创建5个模拟请求
    for (let i = 0; i < 5; i++) {
        const controller = new AbortController();
        controllers.push(controller);
        
        const promise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                resolve(`请求 ${i + 1} 完成`);
            }, 2000 + Math.random() * 3000); // 2-5秒随机延迟
            
            // 监听取消信号
            controller.signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new Error(`请求 ${i + 1} 被取消`));
            });
        });
        
        promises.push(promise);
    }
    
    console.log("已启动5个并发请求...");
    
    // 1.5秒后取消所有请求
    setTimeout(() => {
        console.log("正在取消所有请求...");
        controllers.forEach(controller => controller.abort());
    }, 1500);
    
    // 等待所有请求完成或被取消
    const results = await Promise.allSettled(promises);
    
    console.log("结果:");
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            console.log(`✓ ${result.value}`);
        } else {
            console.log(`✗ ${result.reason.message}`);
        }
    });
    
    console.log("测试完成");
}

// 如果在Node.js环境中运行
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testAbortFunctionality };
}

// 如果在浏览器环境中运行
if (typeof window !== 'undefined') {
    window.testAbortFunctionality = testAbortFunctionality;
}