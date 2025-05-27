document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('startBtn');
  const status = document.getElementById('status');
  const minDelayInput = document.getElementById('minDelay');
  const maxDelayInput = document.getElementById('maxDelay');
  const followCheck = document.getElementById('followCheck');
  const mainInterface = document.getElementById('mainInterface');
  const verifyFollowBtn = document.getElementById('verifyFollowBtn');
  const skipFollowBtn = document.getElementById('skipFollowBtn');

  // 检查关注状态
  function checkFollowStatus() {
    chrome.storage.sync.get(['hasFollowed', 'skipCount', 'lastSkipDate'], function(result) {
      const hasFollowed = result.hasFollowed || false;
      const skipCount = result.skipCount || 0;
      const lastSkipDate = result.lastSkipDate || 0;
      const now = Date.now();
      const daysSinceLastSkip = (now - lastSkipDate) / (1000 * 60 * 60 * 24);
      
      // 如果已经关注，或者跳过次数少于3次且距离上次跳过不到1天，允许使用
      if (hasFollowed || (skipCount < 3 && daysSinceLastSkip < 1)) {
        showMainInterface();
      } else {
        showFollowCheck();
      }
    });
  }

  function showFollowCheck() {
    followCheck.style.display = 'block';
    mainInterface.style.display = 'none';
  }

  function showMainInterface() {
    followCheck.style.display = 'none';
    mainInterface.style.display = 'block';
    
    // 恢复之前保存的设置
    chrome.storage.sync.get(['minDelay', 'maxDelay'], function(result) {
      if (result.minDelay) minDelayInput.value = result.minDelay;
      if (result.maxDelay) maxDelayInput.value = result.maxDelay;
    });
  }

  // 验证关注按钮 - 增强验证
  verifyFollowBtn.addEventListener('click', async function() {
    // 先检查用户是否访问了推特页面
    const hasVisitedTwitter = await checkTwitterVisit();
    
    if (!hasVisitedTwitter) {
      if (confirm('请先点击"关注推特"按钮访问 @meloner6 的推特页面进行关注，然后再回来验证。现在打开推特页面吗？')) {
        window.open('https://twitter.com/meloner6', '_blank');
        return;
      }
    }
    
    // 多重确认验证
    const confirmations = [
      '请确认：您已经关注了 @meloner6 的推特账号吗？',
    ];
    
    let allConfirmed = true;
    for (let i = 0; i < confirmations.length; i++) {
      if (!confirm(confirmations[i])) {
        allConfirmed = false;
        break;
      }
      // 在确认之间添加短暂延迟
      if (i < confirmations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (allConfirmed) {
      // 记录验证时间和方法
      chrome.storage.sync.set({ 
        hasFollowed: true,
        verificationTime: Date.now(),
        verificationMethod: 'manual_confirm'
      }, function() {
        showMainInterface();
        if (status) {
          status.textContent = '🎉 感谢关注！现在可以使用全部功能了';
          status.style.color = '#4CAF50';
        }
      });
    } else {
      if (status) {
        status.textContent = '❌ 请先关注 @meloner6 再进行验证';
        status.style.color = '#ff6b6b';
      }
    }
  });

  // 检查是否访问过推特的辅助函数
  async function checkTwitterVisit() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['lastTwitterVisit'], function(result) {
        const lastVisit = result.lastTwitterVisit || 0;
        const now = Date.now();
        // 如果5分钟内访问过推特，认为可能已经关注
        const recentVisit = (now - lastVisit) < 5 * 60 * 1000;
        resolve(recentVisit);
      });
    });
  }

  // 跳过按钮
  skipFollowBtn.addEventListener('click', function() {
    chrome.storage.sync.get(['skipCount', 'lastSkipDate'], function(result) {
      const skipCount = (result.skipCount || 0) + 1;
      const lastSkipDate = Date.now();
      
      chrome.storage.sync.set({ 
        skipCount: skipCount, 
        lastSkipDate: lastSkipDate 
      }, function() {
        showMainInterface();
        
        if (status) {
          if (skipCount >= 3) {
            status.textContent = '⚠️ 免费试用次数已用完，请关注作者推特继续使用';
            status.style.color = '#ff6b6b';
          } else {
            status.textContent = `ℹ️ 免费试用 ${skipCount}/3 次，关注作者可无限使用`;
            status.style.color = '#ffc107';
          }
        }
      });
    });
  });

  // 初始化时检查关注状态
  checkFollowStatus();

  // 保存设置
  function saveSettings() {
    chrome.storage.sync.set({
      minDelay: parseInt(minDelayInput.value),
      maxDelay: parseInt(maxDelayInput.value)
    });
  }

  minDelayInput.addEventListener('change', saveSettings);
  maxDelayInput.addEventListener('change', saveSettings);

  startBtn.addEventListener('click', async function() {
    const minDelay = parseInt(minDelayInput.value);
    const maxDelay = parseInt(maxDelayInput.value);

    if (minDelay >= maxDelay) {
      status.textContent = '❌ 最小间隔必须小于最大间隔';
      status.style.color = '#ff6b6b';
      return;
    }

    startBtn.disabled = true;
    startBtn.textContent = '⏳ 执行中...';
    status.textContent = '🔍 正在查找关注按钮...';
    status.style.color = '#fff';

    try {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // 向内容脚本发送消息
      await chrome.tabs.sendMessage(tab.id, {
        action: 'startFollowing',
        minDelay: minDelay,
        maxDelay: maxDelay
      });
      
      status.textContent = '✅ 命令已发送到页面';
      
    } catch (error) {
      console.error('Error:', error);
      status.textContent = '❌ 执行失败，请刷新页面重试';
      status.style.color = '#ff6b6b';
    } finally {
      setTimeout(() => {
        startBtn.disabled = false;
        startBtn.textContent = '🚀 开始批量关注';
        // 自动关闭弹窗
        window.close();
      }, 2000);
    }
  });

  // 监听来自内容脚本的消息
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateStatus') {
      status.textContent = request.message;
      if (request.color) {
        status.style.color = request.color;
      }
    }
  });
}); 