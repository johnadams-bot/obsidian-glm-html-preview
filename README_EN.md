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
    "apiKey": "your-api-key-here",
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

## License

MIT
