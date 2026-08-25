<!-- readme-lang-toggle-start -->
<div align="right">
  <strong>🌐 Language:</strong>
  <button onclick="switchLang('zh')" id="btn-zh" style="background:#4a90e2;color:#fff;border:none;padding:4px 12px;margin:0 4px;border-radius:4px;cursor:pointer;">中文</button>
  <button onclick="switchLang('en')" id="btn-en" style="background:#eee;color:#333;border:1px solid #ccc;padding:4px 12px;margin:0 4px;border-radius:4px;cursor:pointer;">English</button>
</div>
<script>
function switchLang(lang) {
  document.getElementById('zh-content').style.display = lang === 'zh' ? 'block' : 'none';
  document.getElementById('en-content').style.display = lang === 'en' ? 'block' : 'none';
  document.getElementById('btn-zh').style.background = lang === 'zh' ? '#4a90e2' : '#eee';
  document.getElementById('btn-zh').style.color = lang === 'zh' ? '#fff' : '#333';
  document.getElementById('btn-en').style.background = lang === 'en' ? '#4a90e2' : '#eee';
  document.getElementById('btn-en').style.color = lang === 'en' ? '#fff' : '#333';
  localStorage.setItem('lang', lang);
}
(function() {
  const saved = localStorage.getItem('lang') || 'zh';
  switchLang(saved);
})();
</script>
<!-- readme-lang-toggle-end -->

<!-- zh-content-start -->
<div id="zh-content">

# GLM HTML Preview for Obsidian

把当前 Obsidian Markdown 笔记一键转换成更耐看的 HTML 预览，**原生支持智谱AI GLM-4-Flash 免费模型**。

## 功能特点

- **免费 AI 预览**：原生支持智谱AI GLM-4-Flash，无需付费 API Key
- **三档预览模式**：
  - 快速预览：不调用 AI，直接渲染 Markdown
  - AI 润色预览：调用 GLM-4-Flash 优化文章结构
  - AI 网页化预览：生成更像网页的布局
- **支持导出**：可导出 HTML 到 vault 指定目录
- **完整支持**：内链、图片、代码块、表格、callout 等

## 安装方式

### 方法一：从 releases 下载（推荐）

1. 前往 [Releases 页面](https://github.com/johnadams-bot/obsidian-glm-html-preview/releases) 下载最新版 `main.js`、`manifest.json`、`styles.css`
2. 将这三个文件放入你的 Obsidian vault 的 `.obsidian/plugins/glm-html-preview/` 目录
3. 重启 Obsidian，在设置 → 第三方插件 中启用

### 方法二：手动安装

1. 克隆本仓库
2. 复制 `main.js`、`manifest.json`、`styles.css` 到 vault 插件目录
3. 重启 Obsidian 并启用插件

## 配置 GLM-4-Flash

1. 访问 [智谱AI开放平台](https://bigmodel.cn/) 注册账号
2. 登录后可在个人中心获取 API Key（**GLM-4-Flash 目前免费**）
3. 在 Obsidian 插件设置中配置：
   - 服务商：选择 "智谱AI (GLM)"
   - API Key：粘贴你的密钥
   - Base URL：`https://open.bigmodel.cn/api/paas/v4/chat/completions`
   - 模型名：`glm-4-flash`

## 示例配置

```json
{
  "provider": "glm",
  "temperature": 0.3,
  "maxTokens": 32000,
  "glm": {
    "apiKey": "***",
    "baseUrl": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    "model": "glm-4-flash"
  }
}
```

## 使用说明

1. 打开任意 Markdown 笔记
2. 点击左侧 ribbon 的闪光按钮，或运行命令 "将当前文档转换为 GLM HTML 预览"
3. 预览页顶部提供：
   - `刷新`：重新渲染
   - `AI 润色预览`：调用 GLM 优化
   - `AI 网页化预览`：生成网页布局
   - `导出 HTML`：保存到 vault
   - `✕ 关闭`：恢复原笔记视图

## 许可证

MIT

</div>
<!-- zh-content-end -->

<!-- en-content-start -->
<div id="en-content" style="display:none;">

# GLM HTML Preview for Obsidian

Convert Obsidian Markdown notes into beautiful HTML previews with **free GLM-4-Flash AI support**.

## Features

- **Free AI Preview**: Native support for Zhipu AI GLM-4-Flash, no paid API key required
- **Three Preview Modes**:
  - Quick Preview: Direct Markdown rendering without AI
  - AI Polish Preview: Optimize article structure with GLM-4-Flash
  - AI Webify Preview: Generate web-like layout
- **Export Support**: Export HTML to your vault directory
- **Full Support**: Internal links, images, code blocks, tables, callouts

## Installation

### Method 1: Download from Releases (Recommended)

1. Go to [Releases page](https://github.com/johnadams-bot/obsidian-glm-html-preview/releases) and download the latest `main.js`, `manifest.json`, `styles.css`
2. Place these three files in your Obsidian vault's `.obsidian/plugins/glm-html-preview/` directory
3. Restart Obsidian and enable in Settings → Community Plugins

### Method 2: Manual Install

1. Clone this repository
2. Copy `main.js`, `manifest.json`, `styles.css` to your vault plugin directory
3. Restart Obsidian and enable the plugin

## Configure GLM-4-Flash

1. Register at [Zhipu AI Open Platform](https://bigmodel.cn/)
2. Get your API Key from personal center (**GLM-4-Flash is currently free**)
3. Configure in Obsidian plugin settings:
   - Provider: Select "智谱AI (GLM)"
   - API Key: Paste your key
   - Base URL: `https://open.bigmodel.cn/api/paas/v4/chat/completions`
   - Model: `glm-4-flash`

## Example Configuration

```json
{
  "provider": "glm",
  "temperature": 0.3,
  "maxTokens": 32000,
  "glm": {
    "apiKey": "***",
    "baseUrl": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    "model": "glm-4-flash"
  }
}
```

## Usage

1. Open any Markdown note
2. Click the sparkle icon on the left ribbon, or run the command "Convert current document to GLM HTML Preview"
3. Preview page provides:
   - `Refresh`: Re-render
   - `AI Polish Preview`: Optimize with GLM
   - `AI Webify Preview`: Generate web layout
   - `Export HTML`: Save to vault
   - `✕ Close`: Return to original note view

## License

MIT

</div>
<!-- en-content-end -->
