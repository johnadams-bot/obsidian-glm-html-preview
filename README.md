# GLM HTML Preview for Obsidian

> 🌐 **Languages**: [English](README_EN.md) | **中文** | [日本語](README_JA.md)

<p align="center">
  <img src="https://img.shields.io/badge/Obsidian-Community_Plugin-blue" alt="Obsidian Plugin">
  <img src="https://img.shields.io/badge/GLM--4--Flash-Free-green" alt="Free Model">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT License">
</p>

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

---

## English

> Convert Obsidian Markdown notes into beautiful HTML previews with **free GLM-4-Flash AI support**.

### Features

- **Free AI Preview**: Native support for Zhipu AI GLM-4-Flash, no paid API key required
- **Three Preview Modes**:
  - Quick Preview: Direct Markdown rendering without AI
  - AI Polish Preview: Optimize article structure with GLM-4-Flash
  - AI Webify Preview: Generate web-like layout
- **Export Support**: Export HTML to your vault directory
- **Full Support**: Internal links, images, code blocks, tables, callouts

### Installation

1. Download the latest `main.js`, `manifest.json`, `styles.css` from [Releases](https://github.com/johnadams-bot/obsidian-glm-html-preview/releases)
2. Place them in your Obsidian vault's `.obsidian/plugins/glm-html-preview/` directory
3. Restart Obsidian and enable in Settings → Community Plugins

### License

MIT
