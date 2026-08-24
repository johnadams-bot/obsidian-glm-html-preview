# GLM HTML Preview for Obsidian

Beautiful HTML preview plugin with native GLM-4-Flash free model support.

## Features

- **Free AI Preview**: Native support for Zhipu AI GLM-4-Flash (free tier)
- **Three preview modes**: Quick, AI Polish, AI Webify
- **Export support**: Save HTML to your vault
- **Full markdown support**: Links, images, code blocks, tables, callouts

## Quick Start

1. Download from [Releases](https://github.com/zbq/obsidian-glm-html-preview/releases)
2. Copy `main.js`, `manifest.json`, `styles.css` to `.obsidian/plugins/glm-html-preview/`
3. Restart Obsidian and enable in settings

## GLM-4-Flash Setup

1. Register at [Zhipu AI](https://bigmodel.cn/)
2. Get your API key (GLM-4-Flash is free)
3. Configure in plugin settings:
   - Provider: 智谱AI (GLM)
   - API Key: your key
   - Base URL: `https://open.bigmodel.cn/api/paas/v4/chat/completions`
   - Model: `glm-4-flash`

## License

MIT
