# 🔧 插件配置说明

## 📝 自定义推特账号

在发布插件前，请将以下文件中的推特账号替换为您的实际账号：

### 1. 修改 `popup.html` 文件

**第 84 行附近**：
```html
<div class="account-name">@YourTwitterHandle</div>
```
**第 89 行附近**：
```html
<a href="https://twitter.com/intent/follow?screen_name=YourTwitterHandle" target="_blank" class="follow-twitter-btn">
```

### 2. 修改 `content.js` 文件

**第 156 行附近**：
```html
<a href="https://twitter.com/intent/follow?screen_name=YourTwitterHandle"
```

### 3. 修改 `README.md` 文件

**第 15 行附近**：
```markdown
- **推特账号**: [@YourTwitterHandle](https://twitter.com/YourTwitterHandle)
```

## 🔄 替换步骤

1. **查找替换**：使用编辑器的"查找替换"功能
   - 查找：`YourTwitterHandle`
   - 替换为：您的推特用户名（不含@符号）

2. **检查文件**：确保以下3个文件都已更新
   - `popup.html`
   - `content.js` 
   - `README.md`

3. **测试验证**：
   - 安装插件后点击"关注推特"按钮
   - 确认跳转到正确的推特关注页面

## 🎯 示例

如果您的推特账号是 `@example_dev`，则应该：

- 将所有 `YourTwitterHandle` 替换为 `example_dev`
- 将所有 `@YourTwitterHandle` 替换为 `@example_dev`

## ⚙️ 高级配置

### 修改试用次数
在 `popup.js` 和 `content.js` 中找到：
```javascript
if (hasFollowed || (skipCount < 3 && daysSinceLastSkip < 1)) {
```
将 `3` 改为您希望的试用次数。

### 修改试用周期
将 `daysSinceLastSkip < 1` 中的 `1` 改为您希望的天数。

## 📋 发布前检查清单

- [ ] 推特账号已全部替换
- [ ] 关注链接测试正常
- [ ] 试用次数设置合理
- [ ] 界面文案检查无误
- [ ] 插件功能测试通过

---

**提示**：建议在发布前先用测试账号完整测试一遍关注验证流程。 