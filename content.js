// 批量关注助手 - 内容脚本
class FollowBot {
  constructor() {
    this.isRunning = false;
    this.processedButtons = new Set();
  }

  // 生成随机延迟
  getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // 查找关注按钮
  findFollowButtons() {
    // 支持多种常见的关注按钮选择器
    const selectors = [
      'button[data-testid$="-follow"]',        // 推特风格
      'button[data-testid="follow"]',
      'button[aria-label*="关注"]',
      'button[aria-label*="Follow"]',
      'button:contains("关注")',
      'button:contains("Follow")',
      '.follow-btn',
      '.follow-button',
      '[data-action="follow"]',
      'button[class*="follow"]'
    ];

    let buttons = [];
    
    for (const selector of selectors) {
      try {
        if (selector.includes(':contains')) {
          // 处理 :contains 伪选择器
          const allButtons = document.querySelectorAll('button');
          const text = selector.includes('关注') ? '关注' : 'Follow';
          const matchingButtons = Array.from(allButtons).filter(btn => 
            btn.textContent.trim().includes(text) && 
            !btn.textContent.trim().includes('已关注') &&
            !btn.textContent.trim().includes('Following')
          );
          buttons = buttons.concat(matchingButtons);
        } else {
          const found = Array.from(document.querySelectorAll(selector));
          buttons = buttons.concat(found);
        }
      } catch (e) {
        console.warn(`选择器 ${selector} 出错:`, e);
      }
    }

    // 去重并过滤已处理的按钮
    const uniqueButtons = [...new Set(buttons)].filter(btn => 
      !this.processedButtons.has(btn) && 
      btn.offsetParent !== null && // 确保按钮可见
      !btn.disabled
    );

    return uniqueButtons;
  }

  // 检测是否出现关注限制提示
  checkForFollowLimit() {
    const limitMessages = [
      '您当前不能进行关注',
      '关注过于频繁',
      '操作过于频繁',
      '您的关注请求过多',
      'You are unable to follow',
      'Following too quickly',
      'Rate limit exceeded',
      'Too many requests',
      'Follow limit reached',
      'temporarily restricted',
      '暂时限制',
      '请稍后再试'
    ];

    // 检查页面中是否出现限制提示
    const pageText = document.body.innerText;
    for (const message of limitMessages) {
      if (pageText.includes(message)) {
        console.warn('🚫 检测到关注限制提示:', message);
        this.sendStatusMessage(`🚫 检测到限制: ${message}`, '#ff6b6b');
        return true;
      }
    }

    // 检查是否有错误弹窗或提示框
    const errorSelectors = [
      '[role="alert"]',
      '.error-message',
      '.warning-message',
      '.rate-limit',
      '.follow-limit',
      '[class*="error"]',
      '[class*="warning"]',
      '[data-testid*="error"]'
    ];

    for (const selector of errorSelectors) {
      const errorElements = document.querySelectorAll(selector);
      for (const element of errorElements) {
        const text = element.textContent;
        for (const message of limitMessages) {
          if (text.includes(message)) {
            console.warn('🚫 检测到关注限制元素:', text);
            this.sendStatusMessage(`🚫 检测到限制: ${message}`, '#ff6b6b');
            return true;
          }
        }
      }
    }

    return false;
  }

  // 模拟人类点击行为
  async simulateHumanClick(button) {
    // 滚动到按钮位置
    button.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // 短暂延迟等待滚动完成
    await new Promise(resolve => setTimeout(resolve, 200));

    // 模拟鼠标悬停
    const hoverEvent = new MouseEvent('mouseover', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    button.dispatchEvent(hoverEvent);

    // 短暂延迟
    await new Promise(resolve => setTimeout(resolve, 100));

    // 执行点击
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    button.dispatchEvent(clickEvent);
    
    // 也尝试原生点击
    try {
      button.click();
    } catch (e) {
      console.warn('原生点击失败:', e);
    }

    // 点击后等待一段时间，检查是否出现限制提示
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 检查是否触发了关注限制
    return !this.checkForFollowLimit();
  }

  // 发送状态消息到弹窗
  sendStatusMessage(message, color = null) {
    try {
      chrome.runtime.sendMessage({
        action: 'updateStatus',
        message: message,
        color: color
      });
    } catch (e) {
      // 弹窗可能已关闭，忽略错误
    }
  }

  // 检查使用权限
  async checkUsagePermission() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get(['hasFollowed', 'skipCount', 'lastSkipDate'], function(result) {
          const hasFollowed = result.hasFollowed || false;
          const skipCount = result.skipCount || 0;
          const lastSkipDate = result.lastSkipDate || 0;
          const now = Date.now();
          const daysSinceLastSkip = (now - lastSkipDate) / (1000 * 60 * 60 * 24);
          
          // 检查是否有使用权限
          const hasPermission = hasFollowed || (skipCount < 3 && daysSinceLastSkip < 1);
          resolve(hasPermission);
        });
      } catch (e) {
        // 如果无法访问存储，默认允许使用（兼容性考虑）
        resolve(true);
      }
    });
  }

  // 主要的关注执行函数
  async startFollowing(minDelay = 800, maxDelay = 2000) {
    if (this.isRunning) {
      console.warn('⚠️ 批量关注已在运行中');
      return;
    }

    // 检查使用权限
    const hasPermission = await this.checkUsagePermission();
    if (!hasPermission) {
      console.warn('🚫 使用权限不足，请关注作者推特');
      this.sendStatusMessage('🚫 请先关注作者推特才能使用', '#ff6b6b');
      
      // 显示提示信息
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        max-width: 300px;
      `;
             notification.innerHTML = `
         <div style="margin-bottom: 10px;">
           <strong>🎯 批量关注助手</strong>
         </div>
         <div style="margin-bottom: 8px; font-size: 14px;">
           请先关注作者推特账号才能使用此功能
         </div>
         <div style="margin-bottom: 10px; font-size: 11px; opacity: 0.8;">
           制作不易，感谢支持 ❤️
         </div>
         <a href="https://twitter.com/intent/follow?screen_name=meloner6" 
            target="_blank" 
            style="display: inline-block; background: #1DA1F2; color: white; 
                   text-decoration: none; padding: 6px 12px; border-radius: 4px; 
                   font-size: 12px; margin-right: 10px;">
           🐦 关注 @meloner6
         </a>
         <button onclick="this.parentElement.remove()" 
                 style="background: rgba(255,255,255,0.2); color: white; border: none; 
                        padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">
           关闭
         </button>
       `;
      
      document.body.appendChild(notification);
      
      // 5秒后自动移除通知
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 5000);
      
      return;
    }

    this.isRunning = true;
    
    try {
      const buttons = this.findFollowButtons();
      
      console.log(`🔍 找到 ${buttons.length} 个关注按钮`);
      this.sendStatusMessage(`🔍 找到 ${buttons.length} 个关注按钮`);

      if (buttons.length === 0) {
        console.log('❌ 未找到可关注的按钮');
        this.sendStatusMessage('❌ 未找到可关注的按钮', '#ff6b6b');
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < buttons.length; i++) {
        if (!this.isRunning) break; // 支持中断

        const btn = buttons[i];
        
        try {
          console.log(`⏳ 正在处理第 ${i + 1}/${buttons.length} 个按钮...`);
          this.sendStatusMessage(`⏳ 正在关注 ${i + 1}/${buttons.length}...`);

          const clickSuccess = await this.simulateHumanClick(btn);
          
          if (!clickSuccess) {
            // 检测到关注限制，立即停止
            console.warn('🚫 检测到关注限制，自动停止执行');
            this.sendStatusMessage('🚫 检测到关注限制，已自动停止', '#ff6b6b');
            this.isRunning = false;
            break;
          }
          
          this.processedButtons.add(btn);
          successCount++;
          
          console.log(`✅ 成功点击第 ${i + 1} 个关注按钮`);
          
          // 如果不是最后一个按钮，则等待随机间隔
          if (i < buttons.length - 1) {
            const delay = this.getRandomDelay(minDelay, maxDelay);
            console.log(`⏱️ 等待 ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // 等待期间再次检查是否有限制提示
            if (this.checkForFollowLimit()) {
              console.warn('🚫 等待期间检测到关注限制，自动停止执行');
              this.sendStatusMessage('🚫 检测到关注限制，已自动停止', '#ff6b6b');
              this.isRunning = false;
              break;
            }
          }
          
        } catch (e) {
          console.warn(`⚠️ 第 ${i + 1} 个按钮点击失败：`, e);
          failCount++;
        }
      }

      const finalMessage = `🎯 处理完成! 成功: ${successCount}, 失败: ${failCount}`;
      console.log(finalMessage);
      this.sendStatusMessage(finalMessage, '#4CAF50');

    } catch (error) {
      console.error('❌ 批量关注过程中出错:', error);
      this.sendStatusMessage('❌ 执行过程中出错', '#ff6b6b');
    } finally {
      this.isRunning = false;
    }
  }

  // 停止执行
  stop() {
    this.isRunning = false;
    console.log('⏹️ 批量关注已停止');
    this.sendStatusMessage('⏹️ 已停止执行');
  }
}

// 创建全局实例
const followBot = new FollowBot();

// 监听来自弹窗的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'startFollowing') {
    followBot.startFollowing(request.minDelay, request.maxDelay);
    sendResponse({ success: true });
  } else if (request.action === 'stopFollowing') {
    followBot.stop();
    sendResponse({ success: true });
  }
});

// 添加快捷键支持 (Ctrl+Shift+F)
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'F') {
    e.preventDefault();
    if (followBot.isRunning) {
      followBot.stop();
    } else {
      followBot.startFollowing();
    }
  }
});

// 记录推特页面访问（用于验证）
function recordTwitterVisit() {
  const currentUrl = window.location.href;
  if ((currentUrl.includes('twitter.com') || currentUrl.includes('x.com')) && 
      currentUrl.includes('meloner6')) {
    chrome.storage.sync.set({ 
      lastTwitterVisit: Date.now(),
      visitedProfile: true 
    });
    console.log('🐦 记录访问了 @meloner6 的推特页面');
  }
}

// 页面加载完成后的提示
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 批量关注助手已加载! 快捷键: Ctrl+Shift+F');
    recordTwitterVisit();
  });
} else {
  console.log('🎯 批量关注助手已加载! 快捷键: Ctrl+Shift+F');
  recordTwitterVisit();
} 