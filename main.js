const {
  ItemView,
  MarkdownRenderer,
  Notice,
  Plugin,
  PluginSettingTab,
  requestUrl,
  Setting,
  TFile,
  normalizePath,
} = require("obsidian");

const VIEW_TYPE = "glm-html-preview-view";
const EXPORT_FOLDER = "03. 🟤 表达 Present/ai-outputs/glm-html";
const WEBIFIED_RENDER_VERSION = "2026-07-07-full-coverage-v1";
const POLISHED_RENDER_VERSION = "2026-07-05-polished-layout-v1";
const DEFAULT_SETTINGS = {
  provider: "deepseek",
  temperature: 0.3,
  maxTokens: 16000,
  aiPreviewCacheSize: 5,
  polishPrompt: defaultPolishPrompt(),
  webifyPrompt: defaultWebifyPrompt(),
  deepseek: {
    apiKey: "",
    baseUrl: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat",
  },
  volcengine: {
    apiKey: "",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    model: "",
  },
};

class GLMHtmlView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.currentFile = null;
    this.currentHtml = "";
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return "美观 HTML 预览";
  }

  getIcon() {
    return "sparkles";
  }

  async onOpen() {
    this.contentEl.addClass("glm-html-preview-view");
    this.renderShell();
  }

  async onClose() {
    this.clearPreview();
    this.contentEl.empty();
  }

  renderShell() {
    this.contentEl.empty();
    const shell = this.contentEl.createDiv({ cls: "glm-html-preview-shell" });
    const toolbar = shell.createDiv({ cls: "glm-html-preview-toolbar" });
    this.titleEl = toolbar.createDiv({
      cls: "glm-html-preview-title",
      text: "选择一个 Markdown 文档后点击左侧按钮生成预览",
    });
    const actions = toolbar.createDiv({ cls: "glm-html-preview-actions" });
    const refreshBtn = actions.createEl("button", {
      cls: "glm-html-preview-button",
      text: "刷新",
    });
    refreshBtn.addEventListener("click", () => this.plugin.convertActiveFile());
    const aiBtn = actions.createEl("button", {
      cls: "glm-html-preview-button",
      text: "AI 润色预览",
    });
    aiBtn.addEventListener("click", () => this.plugin.convertActiveFile({ ai: true }));
    const webBtn = actions.createEl("button", {
      cls: "glm-html-preview-button",
      text: "AI 网页化预览",
    });
    webBtn.addEventListener("click", () => this.plugin.convertActiveFile({ web: true }));
    const exportBtn = actions.createEl("button", {
      cls: "glm-html-preview-button",
      text: "导出 HTML",
    });
    exportBtn.addEventListener("click", () => this.exportCurrentHtml());
    this.frame = shell.createEl("iframe", {
      cls: "glm-html-preview-frame",
      attr: { sandbox: "allow-same-origin" },
    });
  }

  async showFile(file, html, options = {}) {
    if (!this.frame) this.renderShell();
    this.currentFile = file;
    this.currentHtml = html;
    const prefix = options.web ? "AI 网页化 HTML 预览" : options.ai ? "AI 润色 HTML 预览" : "HTML 预览";
    this.titleEl.setText(`${prefix}：${file.basename}`);
    this.frame.addEventListener("load", () => this.bindPreviewLinks(), { once: true });
    this.frame.srcdoc = html;
  }

  bindPreviewLinks() {
    const doc = this.frame && this.frame.contentDocument;
    if (!doc || !this.currentFile) return;
    doc.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", (event) => {
        this.handlePreviewLink(event, link);
      });
    });
  }

  async handlePreviewLink(event, link) {
    if (!this.currentFile) return;
    const rawTarget =
      link.getAttribute("data-href") ||
      link.getAttribute("href") ||
      link.textContent ||
      "";
    const target = decodeLinkTarget(rawTarget);
    if (!target) return;

    if (target.startsWith("#")) {
      event.preventDefault();
      this.scrollPreviewToHash(target);
      return;
    }

    event.preventDefault();

    if (/^(https?:|mailto:|obsidian:)/i.test(target)) {
      window.open(target, "_blank");
      return;
    }

    const normalizedTarget = normalizePath(target.replace(/^\.?\//, ""));
    const file = this.plugin.app.vault.getAbstractFileByPath(normalizedTarget);
    if (file instanceof TFile) {
      await this.plugin.app.workspace.getLeaf(false).openFile(file, { active: true });
      return;
    }

    await this.plugin.app.workspace.openLinkText(target, this.currentFile.path, false);
  }

  scrollPreviewToHash(hash) {
    const doc = this.frame && this.frame.contentDocument;
    if (!doc) return;
    const id = decodeLinkTarget(hash.slice(1));
    const target = doc.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  clearPreview() {
    if (this.frame) {
      this.frame.srcdoc = "";
      this.frame.removeAttribute("srcdoc");
      this.frame.remove();
    }
    this.frame = null;
    this.titleEl = null;
    this.currentFile = null;
    this.currentHtml = "";
  }

  async exportCurrentHtml() {
    if (!this.currentFile || !this.currentHtml) {
      new Notice("还没有可导出的 HTML 预览。");
      return;
    }
    const safeName = this.currentFile.basename.replace(/[\\/:*?"<>|]/g, "-");
    const outputPath = normalizePath(`${EXPORT_FOLDER}/${safeName}.html`);
    await ensureFolder(this.plugin.app, EXPORT_FOLDER);
    const existing = this.plugin.app.vault.getAbstractFileByPath(outputPath);
    if (existing instanceof TFile) {
      await this.plugin.app.vault.modify(existing, this.currentHtml);
    } else {
      await this.plugin.app.vault.create(outputPath, this.currentHtml);
    }
    new Notice(`已导出：${outputPath}`);
  }
}

module.exports = class GLMHtmlPreviewPlugin extends Plugin {
  constructor() {
    super(...arguments);
    this.aiPreviewCache = new Map();
  }

  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE, (leaf) => new GLMHtmlView(leaf, this));
    this.addSettingTab(new GLMHtmlPreviewSettingTab(this.app, this));

    this.addRibbonIcon("sparkles", "将当前文档转换为美观 HTML", () => {
      this.convertActiveFile();
    });

    this.addCommand({
      id: "convert-current-note-to-beautiful-html",
      name: "将当前文档转换为美观 HTML",
      callback: () => this.convertActiveFile(),
    });

    this.addCommand({
      id: "ai-polish-current-note-to-beautiful-html",
      name: "AI 润色当前文档并预览为美观 HTML",
      callback: () => this.convertActiveFile({ ai: true }),
    });

    this.addCommand({
      id: "ai-webify-current-note-to-beautiful-html",
      name: "AI 网页化当前文档并预览为高级 HTML",
      callback: () => this.convertActiveFile({ web: true }),
    });

    this.addCommand({
      id: "export-current-note-to-beautiful-html",
      name: "导出当前文档为美观 HTML 文件",
      callback: async () => {
        const view = await this.convertActiveFile();
        if (view) await view.exportCurrentHtml();
      },
    });
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async loadSettings() {
    this.settings = mergeSettings(DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async convertActiveFile(options = {}) {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || file.extension !== "md") {
      new Notice("请先打开一个 Markdown 文档。");
      return null;
    }

    const sourceMarkdown = await this.app.vault.cachedRead(file);
    let previewMarkdown = sourceMarkdown;
    let html = "";
    if (options.web) {
      const cacheKey = this.getAiPreviewCacheKey(file, sourceMarkdown, "web");
      const cached = this.getCachedAiPreview(cacheKey);
      if (cached) {
        const view = await this.openPreviewView();
        await view.showFile(file, cached.html, { web: true });
        new Notice("已显示缓存的 AI 网页化预览。");
        return view;
      }

      const pageData = await this.webifyMarkdownWithAi(sourceMarkdown, file);
      if (!pageData) return null;
      html = this.buildWebifiedHtml(file, sourceMarkdown, pageData);
      this.setCachedAiPreview(cacheKey, {
        filePath: file.path,
        fileName: file.basename,
        html,
        createdAt: Date.now(),
      });
    } else if (options.ai) {
      const cacheKey = this.getAiPreviewCacheKey(file, sourceMarkdown, "polish");
      const cached = this.getCachedAiPreview(cacheKey);
      if (cached) {
        const view = await this.openPreviewView();
        await view.showFile(file, cached.html, { ai: true });
        new Notice("已显示缓存的 AI 润色预览。");
        return view;
      }

      previewMarkdown = await this.polishMarkdownWithAi(sourceMarkdown, file);
      if (!previewMarkdown) return null;
      const rendered = await this.renderMarkdown(file, previewMarkdown);
      html = this.buildBeautifulHtml(file, previewMarkdown, rendered, { ai: true });
      this.setCachedAiPreview(cacheKey, {
        filePath: file.path,
        fileName: file.basename,
        html,
        createdAt: Date.now(),
      });
    } else {
      const rendered = await this.renderMarkdown(file, previewMarkdown);
      html = this.buildBeautifulHtml(file, previewMarkdown, rendered, { ai: false });
    }
    const view = await this.openPreviewView();
    await view.showFile(file, html, { ai: !!options.ai, web: !!options.web });
    new Notice(options.web ? "已生成 AI 网页化 HTML 预览。" : options.ai ? "已生成 AI 润色 HTML 预览。" : "已生成美观 HTML 预览。");
    return view;
  }

  async polishMarkdownWithAi(markdown, file) {
    const config = this.getActiveApiConfig();
    if (!config.apiKey || !config.baseUrl || !config.model) {
      new Notice("请先在 Beautiful HTML Preview 设置里填写 API Key、Base URL 和模型名。");
      return null;
    }

    const notice = new Notice("AI 正在润色当前文档，请稍等...", 0);
    try {
      const response = await requestUrl({
        url: config.baseUrl,
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          temperature: this.settings.temperature,
          max_tokens: this.settings.maxTokens,
          messages: [
            {
              role: "system",
              content: this.settings.polishPrompt || defaultPolishPrompt(),
            },
            {
              role: "user",
              content: `文档路径：${file.path}\n\n请润色并重组下面这份 Obsidian Markdown：\n\n${markdown}`,
            },
          ],
        }),
      });
      const content = response.json && response.json.choices && response.json.choices[0]
        && response.json.choices[0].message
        && response.json.choices[0].message.content;
      if (!content) {
        throw new Error("API 没有返回可用内容。");
      }
      return stripMarkdownFence(content);
    } catch (error) {
      console.error("Beautiful HTML Preview AI polish failed", error);
      new Notice(`AI 润色失败：${error.message || error}`);
      return null;
    } finally {
      notice.hide();
    }
  }

  async webifyMarkdownWithAi(markdown, file) {
    const config = this.getActiveApiConfig();
    if (!config.apiKey || !config.baseUrl || !config.model) {
      new Notice("请先在 Beautiful HTML Preview 设置里填写 API Key、Base URL 和模型名。");
      return null;
    }

    const notice = new Notice("AI 正在生成网页化预览，请稍等...", 0);
    try {
      const response = await requestUrl({
        url: config.baseUrl,
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          temperature: Math.max(0.2, this.settings.temperature),
          max_tokens: this.settings.maxTokens,
          messages: [
            {
              role: "system",
              content: this.settings.webifyPrompt || defaultWebifyPrompt(),
            },
            {
              role: "user",
              content: `文档路径：${file.path}\n\n请把下面这份 Obsidian Markdown 转换为结构化网页页面数据：\n\n${markdown}`,
            },
          ],
        }),
      });
      const content = response.json && response.json.choices && response.json.choices[0]
        && response.json.choices[0].message
        && response.json.choices[0].message.content;
      if (!content) throw new Error("API 没有返回可用内容。");
      return parseJsonPayload(content);
    } catch (error) {
      console.error("Beautiful HTML Preview webify failed", error);
      new Notice(`AI 网页化失败：${error.message || error}`);
      return null;
    } finally {
      notice.hide();
    }
  }

  getActiveApiConfig() {
    const provider = this.settings.provider || "glm";
    if (provider === "volcengine") return this.settings.volcengine;
    if (provider === "deepseek") return this.settings.deepseek;
    return this.settings.glm;
  }

  getAiPreviewCacheKey(file, markdown, mode = "polish") {
    const config = this.getActiveApiConfig();
    const signature = [
      mode,
      mode === "web" ? WEBIFIED_RENDER_VERSION : POLISHED_RENDER_VERSION,
      file.path,
      hashString(markdown),
      this.settings.provider,
      config.baseUrl,
      config.model,
      this.settings.temperature,
      this.settings.maxTokens,
      hashString(mode === "web" ? this.settings.webifyPrompt || defaultWebifyPrompt() : this.settings.polishPrompt || defaultPolishPrompt()),
    ].join("|");
    return hashString(signature);
  }

  getCachedAiPreview(cacheKey) {
    const cached = this.aiPreviewCache.get(cacheKey);
    if (!cached) return null;
    this.aiPreviewCache.delete(cacheKey);
    this.aiPreviewCache.set(cacheKey, cached);
    return cached;
  }

  setCachedAiPreview(cacheKey, value) {
    this.aiPreviewCache.delete(cacheKey);
    this.aiPreviewCache.set(cacheKey, value);
    this.trimAiPreviewCache();
  }

  trimAiPreviewCache() {
    const limit = Math.max(0, Number(this.settings.aiPreviewCacheSize) || 0);
    while (this.aiPreviewCache.size > limit) {
      const oldestKey = this.aiPreviewCache.keys().next().value;
      if (!oldestKey) break;
      this.aiPreviewCache.delete(oldestKey);
    }
  }

  async renderMarkdown(file, markdown) {
    const container = document.createElement("div");
    const component = this;
    if (typeof MarkdownRenderer.render === "function") {
      await MarkdownRenderer.render(this.app, markdown, container, file.path, component);
    } else {
      await MarkdownRenderer.renderMarkdown(markdown, container, file.path, component);
    }
    return container.innerHTML;
  }

  async openPreviewView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getLeaf("split", "vertical");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    return leaf.view;
  }

  buildBeautifulHtml(file, markdown, renderedHtml, options = {}) {
    const meta = extractMeta(markdown, file);
    const body = polishRenderedHtml(renderedHtml);
    const toc = buildToc(body);
    const wordCount = markdown
      .replace(/^---[\s\S]*?---\s*/, "")
      .replace(/```[\s\S]*?```/g, "")
      .trim()
      .length;

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(meta.title)}</title>
  <style>${documentCss()}</style>
</head>
<body class="${options.ai ? "ai-polished" : "quick-preview"}">
  <main class="page ${options.ai ? "page-polished" : "page-quick"}">
    <header class="hero">
      <div class="kicker">${options.ai ? "AI Polished Note" : "Obsidian Note"} · Beautiful HTML</div>
      <h1>${escapeHtml(meta.title)}</h1>
      <div class="meta">
        <span>${escapeHtml(file.path)}</span>
        <span>${new Date().toLocaleDateString("zh-CN")}</span>
        <span>${wordCount} 字符</span>
      </div>
      ${meta.summary ? `<p class="summary">${escapeHtml(meta.summary)}</p>` : ""}
    </header>
    ${toc}
    <article class="content">${body.innerHTML}</article>
  </main>
</body>
</html>`;
  }

  buildWebifiedHtml(file, markdown, pageData) {
    const page = normalizeWebPageData(pageData, file, markdown);
    const mediaItems = extractMediaItems(markdown, file, this.app);
    const heroMedia = mediaItems.find((item) => item.kind === "image");
    const sectionMedia = assignMediaToSections(page.sections, mediaItems, heroMedia);
    const sections = page.sections
      .map((section, index) => renderWebSection(section, index, sectionMedia[index] || []))
      .join("");
    const navItems = page.sections
      .filter((section) => section.anchor && section.title)
      .slice(0, 8)
      .map((section) => `<a href="#${escapeHtml(section.anchor)}">${renderInline(section.title)}</a>`)
      .join("");
    const heroBullets = page.heroBullets
      .slice(0, 4)
      .map((item) => `<li>${renderInline(item)}</li>`)
      .join("");

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <style>${webifiedDocumentCss()}</style>
</head>
<body>
  <header class="site-nav">
    <a class="brand" href="#top"><span></span>${renderInline(page.kicker || "AI 网页化预览")}</a>
    <nav>${navItems}</nav>
  </header>
  <main id="top" data-render-version="${escapeHtml(WEBIFIED_RENDER_VERSION)}">
    <section class="web-hero">
      <div class="hero-copy">
        <p class="eyebrow">${renderInline(page.kicker || "AI Webified Note")}</p>
        <h1>${renderInline(page.title)}</h1>
        <p class="hero-summary">${renderInline(page.subtitle || page.summary || "")}</p>
        <div class="hero-meta">
          <span>${escapeHtml(file.path)}</span>
          <span>${new Date().toLocaleDateString("zh-CN")}</span>
          <span>${markdown.trim().length} 字符</span>
        </div>
      </div>
      <aside class="hero-panel">
        ${heroMedia ? renderMediaFigure(heroMedia, "hero-media") : ""}
        <h2>${renderInline(page.panelTitle || "核心看点")}</h2>
        <ul>${heroBullets}</ul>
      </aside>
    </section>
    ${sections}
  </main>
</body>
</html>`;
  }
};

class GLMHtmlPreviewSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Beautiful HTML Preview" });

    new Setting(containerEl)
      .setName("AI 服务")
      .setDesc("普通预览不需要 API；只有点击“AI 润色预览”时才会调用这里配置的服务。")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("glm", "智谱AI (GLM) ⭐免费")
          .addOption("deepseek", "DeepSeek")
          .addOption("volcengine", "火山引擎")
          .setValue(this.plugin.settings.provider)
          .onChange(async (value) => {
            this.plugin.settings.provider = value;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    this.addProviderSettings("glm", "智谱AI (GLM)");
    this.addProviderSettings("deepseek", "DeepSeek");
    this.addProviderSettings("volcengine", "火山引擎");

    new Setting(containerEl)
      .setName("润色温度")
      .setDesc("数值越低越稳，越高越有创造性。建议 0.2 到 0.5。")
      .addSlider((slider) => {
        slider
          .setLimits(0, 1, 0.1)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.temperature)
          .onChange(async (value) => {
            this.plugin.settings.temperature = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("最大输出 tokens")
      .setDesc("文档越长需要越大。太小可能导致 AI 输出被截断。")
      .addText((text) => {
        text
          .setPlaceholder("16000")
          .setValue(String(this.plugin.settings.maxTokens))
          .onChange(async (value) => {
            const parsed = parseInt(value, 10);
            if (Number.isFinite(parsed) && parsed > 0) {
              this.plugin.settings.maxTokens = parsed;
              await this.plugin.saveSettings();
            }
          });
      });

    new Setting(containerEl)
      .setName("AI 预览内存缓存数量")
      .setDesc("默认缓存最近 5 篇。缓存只在当前 Obsidian 运行期间有效，重载插件或重启后会清空。")
      .addText((text) => {
        text
          .setPlaceholder("5")
          .setValue(String(this.plugin.settings.aiPreviewCacheSize))
          .onChange(async (value) => {
            const parsed = parseInt(value, 10);
            if (Number.isFinite(parsed) && parsed >= 0) {
              this.plugin.settings.aiPreviewCacheSize = parsed;
              this.plugin.trimAiPreviewCache();
              await this.plugin.saveSettings();
            }
          });
      });

    new Setting(containerEl)
      .setName("AI 润色提示词")
      .setDesc("点击“AI 润色预览”时会使用这段提示词。建议保留“信息全覆盖”和“不要编造”的约束。")
      .addTextArea((text) => {
        text.inputEl.rows = 12;
        text.inputEl.style.width = "100%";
        text
          .setValue(this.plugin.settings.polishPrompt || defaultPolishPrompt())
          .onChange(async (value) => {
            this.plugin.settings.polishPrompt = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("AI 网页化提示词")
      .setDesc("点击“AI 网页化预览”时会使用这段提示词。它要求 AI 输出结构化 JSON，再由插件渲染成高级网页。")
      .addTextArea((text) => {
        text.inputEl.rows = 16;
        text.inputEl.style.width = "100%";
        text
          .setValue(this.plugin.settings.webifyPrompt || defaultWebifyPrompt())
          .onChange(async (value) => {
            this.plugin.settings.webifyPrompt = value;
            await this.plugin.saveSettings();
          });
      });
  }

  addProviderSettings(providerKey, label) {
    const settings = this.plugin.settings[providerKey];
    const active = this.plugin.settings.provider === providerKey;
    const group = this.containerEl.createDiv({
      cls: active ? "glm-html-preview-settings-active" : "glm-html-preview-settings-muted",
    });

    group.createEl("h3", { text: `${label}${active ? "（当前使用）" : ""}` });

    new Setting(group)
      .setName(`${label} API Key`)
      .setDesc("只保存在本地 Obsidian 插件数据中。")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("sk-...")
          .setValue(settings.apiKey)
          .onChange(async (value) => {
            settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(group)
      .setName(`${label} Base URL`)
      .setDesc("使用 OpenAI 兼容的 chat completions 地址。")
      .addText((text) => {
        text
          .setPlaceholder("https://...")
          .setValue(settings.baseUrl)
          .onChange(async (value) => {
            settings.baseUrl = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(group)
      .setName(`${label} 模型名`)
      .setDesc(providerKey === "volcengine" ? "填写火山方舟里的 endpoint/model 名称。" : "DeepSeek 默认可以使用 deepseek-chat。")
      .addText((text) => {
        text
          .setPlaceholder(providerKey === "deepseek" ? "deepseek-chat" : "你的火山模型名")
          .setValue(settings.model)
          .onChange(async (value) => {
            settings.model = value.trim();
            await this.plugin.saveSettings();
          });
      });
  }
}

function mergeSettings(defaults, saved) {
  const output = JSON.parse(JSON.stringify(defaults));
  if (!saved || typeof saved !== "object") return output;
  for (const [key, value] of Object.entries(saved)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === "object"
    ) {
      output[key] = { ...output[key], ...value };
    } else {
      output[key] = value;
    }
  }
  return output;
}

function defaultPolishPrompt() {
  return [
    "你是一个中文 Markdown 内容编辑和轻量版面策划师。",
    "任务：把用户提供的 Obsidian Markdown 做成“第二档 AI 润色预览”：比普通刷新更清楚、更好看、更有结构，但不要变成完整网页策划稿。",
    "",
    "润色程度：中度主动编辑。",
    "1. 不只是改错别字。你需要主动判断原文框架是否松散，并适度重组标题、段落、小节和列表。",
    "2. 如果一段里出现多个项目点、并列点、流程点、优缺点、功能点、原因点，请拆成自然分行的列表或小标题段落，不要堆成一整段。",
    "3. 可以合并重复表达、改顺长句、补出清晰小标题、调整段落顺序，让阅读路径更顺。",
    "4. 可以把特别关键的一句话整理为简短 blockquote，但不要大量使用夸张引用，不要做成第三档那种网页化 JSON/卡片页面。",
    "",
    "内容边界：",
    "1. 信息必须全覆盖，不删除事实、链接、清单项、日期、数字、引用、例子、待办和结论。",
    "2. 不编造原文没有的新事实，不添加空泛鸡汤。",
    "3. 保留 Obsidian 内链、Markdown 链接、图片、表格、代码块、callout、任务列表。",
    "4. 文件路径和图片引用要保留在 Markdown 语法里，但不要把路径单独改写成正文说明。",
    "",
    "输出要求：",
    "1. 只输出润色后的 Markdown 正文。",
    "2. 不输出解释，不输出前后寒暄，不用代码块包裹。",
    "3. 目标效果：像一篇经过编辑整理的清爽文章，而不是原文的机械复刻。",
  ].join("\n");
}

function defaultWebifyPrompt() {
  return [
    "你是一个顶级中文网页内容策划师、信息架构师和 Obsidian Markdown 整理专家。",
    "任务：把用户提供的 Obsidian Markdown 转换为适合高级 HTML 页面渲染的结构化 JSON 数据。",
    "",
    "核心原则：网页化是“重排、改写、增强可读性”，不是“摘要、删减、只保留重点”。",
    "",
    "设计目标：",
    "1. 页面要比普通文章更丰富，具有清晰层次、分栏、卡片、流程、FAQ、重点区块、细节区块等网页化结构。",
    "2. 风格应简约、耐看、现代、克制，尽可能贴合 HTML 网页阅读习惯。",
    "3. 可以大胆调整标题、段落顺序、分组、语气和呈现方式，让它更像一篇真正的网页文章。",
    "",
    "绝对内容要求：",
    "1. 必须全面覆盖原文档的所有核心内容和细节内容，不得省略事实、日期、数字、链接、例子、结论、待办、清单项、表格信息、引用信息、文件名和附件引用。",
    "2. 不允许为了美观而删掉正文主体。美观只能通过重排、分组、改写、拆段、列表化、卡片化实现，不能通过删减实现。",
    "3. 如果原文是外刊精读、句子解析、英语学习材料、试卷解析、错题整理、教程步骤、课堂讲义，所有逐句解析、题目解析、答案解析、词汇讲解、语法点、例句和步骤必须逐项保留。",
    "4. 外刊精读尤其注意：每一个被解析的英文句子、对应中文解释、词汇/短语、语法结构、长难句分析、参考译文、要点解析都必须出现在输出 JSON 中，不能只保留导语或总结。",
    "5. 如果原文某一部分很长，就为它创建更多 section 或更多 items；不要把长内容压缩成一句概括。",
    "6. 对于原文中的 H2/H3/H4 层级，原则上都要在输出中有对应的 section、item 或正文段落承接，不能整节丢失。",
    "",
    "改写要求：",
    "1. 可以深度优化语法、措辞、标题、段落顺序和分组，让内容更适合网页阅读。",
    "2. 可以把冗长段落拆成项目点、步骤、卡片或 FAQ。",
    "3. 可以把口语化或草稿感表达改成更清楚、更适合发布的网页表达。",
    "4. 不得编造原文没有的新事实，不得添加空泛结论，不得把不确定内容写成确定事实。",
    "",
    "链接和媒体要求：",
    "1. 保留 Obsidian 内链、Markdown 链接、图片、视频、音频和附件路径。",
    "2. 链接可保留为 Markdown 链接或 Obsidian wikilink。",
    "3. 媒体不要集中堆到最后，应尽量放在与原文语义对应的 section 附近。",
    "",
    "输出长度策略：",
    "1. sections 不设固定上限。短文可 4-8 个 section，长文可以 10-30 个 section，按原文信息量决定。",
    "2. 不要因为 JSON 很长就省略内容。宁可输出更多 text section，也不要丢内容。",
    "3. 如果某部分不适合卡片化，就用 type=text 完整承载。",
    "",
    "输出要求：只输出 JSON，不要解释，不要寒暄，不要用代码块包裹。",
    "JSON schema：",
    "{",
    '  "title": "页面主标题",',
    '  "subtitle": "一句较有吸引力的副标题",',
    '  "kicker": "短标签",',
    '  "panelTitle": "右侧重点面板标题",',
    '  "heroBullets": ["3到4条核心看点"],',
    '  "sections": [',
    '    {"type":"split","anchor":"why","title":"区块标题","intro":"区块导语","body":"主体文字","quote":"重点句","items":[{"title":"小卡标题","body":"小卡正文"}]},',
    '    {"type":"cards","anchor":"cards","title":"卡片区标题","intro":"卡片区导语","items":[{"title":"卡片标题","body":"卡片正文"}]},',
    '    {"type":"steps","anchor":"flow","title":"流程标题","intro":"流程导语","items":[{"title":"步骤标题","body":"步骤说明"}]},',
    '    {"type":"quote","anchor":"insight","title":"洞察标题","body":"重点洞察正文"},',
    '    {"type":"faq","anchor":"faq","title":"问答标题","items":[{"title":"问题","body":"答案"}]},',
    '    {"type":"text","anchor":"detail","title":"普通区块标题","intro":"导语","body":"正文"}',
    "  ]",
    "}",
    "每个 section 的 anchor 使用英文小写、数字或短横线。",
    "最终自检：输出前逐项检查原文每个主要标题、每个解析句子、每个清单、每个步骤和每个链接是否都已经进入 JSON；如有遗漏，补进 sections。",
  ].join("\n");
}

function stripMarkdownFence(content) {
  const trimmed = content.trim();
  const match = trimmed.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function parseJsonPayload(content) {
  const trimmed = stripMarkdownFence(content);
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw error;
  }
}

function normalizeWebPageData(pageData, file, markdown) {
  const meta = extractMeta(markdown, file);
  const page = pageData && typeof pageData === "object" ? pageData : {};
  const sections = Array.isArray(page.sections) ? page.sections : [];
  return {
    title: String(page.title || meta.title || file.basename),
    subtitle: String(page.subtitle || page.summary || meta.summary || ""),
    kicker: String(page.kicker || "AI 网页化预览"),
    panelTitle: String(page.panelTitle || "核心看点"),
    heroBullets: normalizeStringArray(page.heroBullets).length
      ? normalizeStringArray(page.heroBullets)
      : [meta.summary || "这份笔记已被整理为更适合网页阅读的结构。"],
    sections: sections.length ? sections.map(normalizeWebSection) : [{
      type: "text",
      anchor: "content",
      title: "完整内容",
      intro: meta.summary,
      body: markdown,
      items: [],
    }],
  };
}

function normalizeWebSection(section, index) {
  const value = section && typeof section === "object" ? section : {};
  const title = String(value.title || `Section ${index + 1}`);
  return {
    type: ["split", "cards", "steps", "quote", "faq", "text"].includes(value.type) ? value.type : "text",
    anchor: safeAnchor(value.anchor || title || `section-${index + 1}`),
    title,
    intro: String(value.intro || ""),
    body: String(value.body || ""),
    quote: String(value.quote || ""),
    items: Array.isArray(value.items) ? value.items.map((item) => ({
      title: String((item && item.title) || ""),
      body: String((item && item.body) || item || ""),
    })) : [],
  };
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function safeAnchor(value) {
  const anchor = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return anchor || `section-${Math.random().toString(36).slice(2, 8)}`;
}

function renderWebSection(section, index, mediaItems = []) {
  const commonHead = `<div class="section-head"><p>${String(index + 1).padStart(2, "0")}</p><h2>${renderInline(section.title)}</h2>${section.intro ? `<div>${renderBlocks(section.intro)}</div>` : ""}</div>`;
  if (section.type === "split") {
    const itemMedia = assignMediaToItems(section.items, mediaItems);
    const used = new Set();
    const items = section.items.slice(0, 6).map((item, itemIndex) => {
      const media = itemMedia[itemIndex] || [];
      media.forEach((entry) => used.add(entry.src));
      return `<article><h3>${renderInline(item.title)}</h3>${renderTextBody(item.body)}${renderMediaStrip(media, "inline-media")}</article>`;
    }).join("");
    const remainingMedia = mediaItems.filter((item) => !used.has(item.src));
    return `<section id="${escapeHtml(section.anchor)}" class="web-section split-section">${commonHead}<div class="split-grid"><div class="split-main">${renderBlocks(section.body)}${renderMediaStrip(remainingMedia, "section-media")}${renderInsightNote(section.quote)}</div><div class="mini-grid">${items}</div></div></section>`;
  }
  if (section.type === "cards") {
    const itemMedia = assignMediaToItems(section.items, mediaItems);
    const cards = section.items.map((item, itemIndex) => `<article class="web-card"><h3>${renderInline(item.title)}</h3>${renderTextBody(item.body)}${renderMediaStrip(itemMedia[itemIndex] || [], "inline-media")}</article>`).join("");
    return `<section id="${escapeHtml(section.anchor)}" class="web-section cards-section">${commonHead}<div class="card-grid">${cards}</div></section>`;
  }
  if (section.type === "steps") {
    const itemMedia = assignMediaToItems(section.items, mediaItems);
    const steps = section.items.map((item, stepIndex) => `<article class="step"><span>${String(stepIndex + 1).padStart(2, "0")}</span><h3>${renderInline(item.title)}</h3>${renderTextBody(item.body)}${renderMediaStrip(itemMedia[stepIndex] || [], "inline-media")}</article>`).join("");
    return `<section id="${escapeHtml(section.anchor)}" class="web-section steps-section">${commonHead}<div class="steps">${steps}</div></section>`;
  }
  if (section.type === "quote") {
    return `<section id="${escapeHtml(section.anchor)}" class="web-section quote-section">${commonHead}${renderInsightNote(section.body || section.quote, "重点洞察")}${renderMediaStrip(mediaItems, "section-media")}</section>`;
  }
  if (section.type === "faq") {
    const itemMedia = assignMediaToItems(section.items, mediaItems);
    const faqs = section.items.map((item, faqIndex) => `<details ${faqIndex === 0 ? "open" : ""}><summary>${renderInline(item.title)}</summary>${renderTextBody(item.body)}${renderMediaStrip(itemMedia[faqIndex] || [], "inline-media")}</details>`).join("");
    return `<section id="${escapeHtml(section.anchor)}" class="web-section faq-section">${commonHead}<div class="faq-list">${faqs}</div></section>`;
  }
  return `<section id="${escapeHtml(section.anchor)}" class="web-section text-section">${commonHead}<div class="text-panel">${renderBlocks(section.body)}${renderMediaStrip(mediaItems, "section-media")}</div></section>`;
}

function renderInsightNote(text, label = "轻量摘记") {
  const value = String(text || "").trim();
  if (!value) return "";
  return `<aside class="insight-note"><span>${escapeHtml(label)}</span><div>${renderBlocks(value)}</div></aside>`;
}

function renderBlocks(text) {
  return String(text)
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => renderSmartParagraph(part))
    .join("");
}

function renderTextBody(text) {
  const html = renderBlocks(text);
  return html || "<p></p>";
}

function renderSmartParagraph(text) {
  const normalized = normalizeParagraphSpacing(text);
  const numbered = splitNumberedPoints(normalized);
  if (numbered) return renderSmartList(numbered);

  const semantic = splitSemanticPoints(normalized);
  if (semantic) return renderSmartList(semantic, "semantic-list");

  return `<p>${renderInline(normalized)}</p>`;
}

function renderSmartList(list, extraClass = "") {
  const intro = list.intro ? `<p>${renderInline(list.intro)}</p>` : "";
  const items = list.items
    .map((item) => `<li><span>${escapeHtml(item.marker)}</span><div>${renderInline(item.body)}</div></li>`)
    .join("");
  return `<div class="smart-list${extraClass ? ` ${extraClass}` : ""}">${intro}<ol>${items}</ol></div>`;
}

function splitNumberedPoints(text) {
  const markerPattern = /(^|[\s：:；;，,。])([0-9０-９]{1,2}(?:[.．][0-9０-９]{1,2})?|[①②③④⑤⑥⑦⑧⑨⑩❶❷❸❹❺❻❼❽❾❿])[.．、)]?\s*/g;
  const matches = Array.from(text.matchAll(markerPattern))
    .filter((match, index, all) => {
      const marker = normalizeListMarker(match[2]);
      if (index === 0) return true;
      const previous = normalizeListMarker(all[index - 1][2]);
      return isSequentialMarker(previous, marker) || marker !== previous;
    });
  if (matches.length < 2) return null;

  const items = matches.map((match, index) => {
    const markerStart = match.index + match[1].length;
    const bodyStart = markerStart + match[0].slice(match[1].length).length;
    const bodyEnd = index + 1 < matches.length ? matches[index + 1].index : text.length;
    return {
      marker: normalizeListMarker(match[2]),
      body: text.slice(bodyStart, bodyEnd).trim(),
    };
  }).filter((item) => item.body);

  if (items.length < 2) return null;
  return {
    intro: text.slice(0, matches[0].index).trim(),
    items,
  };
}

function splitSemanticPoints(text) {
  const markerPattern = /(^|[\s。；;])(?:\*\*)?([A-Za-z0-9\u4e00-\u9fa5][A-Za-z0-9\u4e00-\u9fa5\s/+-]{1,22}?)[：:](?:\*\*)?\s*/g;
  const matches = Array.from(text.matchAll(markerPattern))
    .filter((match) => isSemanticLabel(match[2]));
  if (matches.length < 2) return null;

  const items = matches.map((match, index) => {
    const markerStart = match.index + match[1].length;
    const bodyStart = markerStart + match[0].slice(match[1].length).length;
    const bodyEnd = index + 1 < matches.length ? matches[index + 1].index : text.length;
    return {
      marker: cleanSemanticLabel(match[2]),
      body: text.slice(bodyStart, bodyEnd).replace(/^[。；;，,\s]+/, "").trim(),
    };
  }).filter((item) => item.marker && item.body);

  if (items.length < 2) return null;
  return {
    intro: text.slice(0, matches[0].index).trim(),
    items,
  };
}

function isSemanticLabel(label) {
  const text = cleanSemanticLabel(label);
  if (text.length < 2 || text.length > 18) return false;
  if (/[。；;，,！？?!()[\]{}<>]/.test(text)) return false;
  if (/^(http|https|file|app|obsidian|png|jpg|jpeg|gif|webp|svg|mp4)$/i.test(text)) return false;
  const meaningfulChars = text.match(/[\u4e00-\u9fa5A-Za-z]/g) || [];
  return meaningfulChars.length >= 2;
}

function cleanSemanticLabel(label) {
  return stripMarkdownInline(String(label || ""))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeParagraphSpacing(text) {
  return String(text || "")
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeListMarker(marker) {
  return String(marker || "").replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));
}

function isSequentialMarker(previous, current) {
  const previousNumber = markerToNumber(previous);
  const currentNumber = markerToNumber(current);
  return previousNumber > 0 && currentNumber === previousNumber + 1;
}

function markerToNumber(marker) {
  const circled = "①②③④⑤⑥⑦⑧⑨⑩❶❷❸❹❺❻❼❽❾❿";
  const index = circled.indexOf(marker);
  if (index >= 0) return (index % 10) + 1;
  const parsed = parseInt(String(marker).split(/[.．]/)[0], 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderInline(text) {
  let html = escapeHtml(String(text || ""));
  html = html.replace(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, (_match, target) => `<span class="inline-asset">${escapeHtml(target)}</span>`);
  html = html.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_match, target, label) => `<a href="${escapeHtml(target)}">${escapeHtml(label)}</a>`);
  html = html.replace(/\[\[([^\]]+)\]\]/g, (_match, target) => `<a href="${escapeHtml(target)}">${escapeHtml(target)}</a>`);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, target) => `<a href="${escapeHtml(target)}">${escapeHtml(label)}</a>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, (match) => `<span class="num-chip">${match}</span>`);
  return html;
}

function extractMediaItems(markdown, sourceFile, app) {
  const items = [];
  const seen = new Set();
  let currentHeading = "";
  let currentSubheading = "";

  markdown.split(/\r?\n/).forEach((line, lineIndex) => {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (heading) {
      currentHeading = stripMarkdownInline(heading[2]);
      currentSubheading = "";
    } else {
      const boldHeading = line.match(/^\s*(?:[-*+]\s*)?\*\*([^*]{2,90})\*\*\s*[:：]?\s*$/);
      if (boldHeading) currentSubheading = stripMarkdownInline(boldHeading[1]);
    }

    for (const match of line.matchAll(/!\[\[([^\]]+)\]\]/g)) {
      const raw = match[1];
      const [targetPart, captionPart] = raw.split("|");
      const target = cleanMediaTarget(targetPart);
      addMediaItem(items, seen, addMediaContext(
        resolveMediaItem(target, captionPart || "", sourceFile, app),
        currentHeading,
        currentSubheading,
        lineIndex
      ));
    }

    for (const match of line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
      const caption = match[1] || "";
      const target = cleanMediaTarget(match[2]);
      addMediaItem(items, seen, addMediaContext(
        resolveMediaItem(target, caption, sourceFile, app),
        currentHeading,
        currentSubheading,
        lineIndex
      ));
    }
  });

  return items;
}

function addMediaContext(item, heading, subheading, lineIndex) {
  if (!item) return null;
  return {
    ...item,
    heading,
    subheading,
    lineIndex,
  };
}

function addMediaItem(items, seen, item) {
  if (!item || seen.has(item.src)) return;
  seen.add(item.src);
  items.push(item);
}

function resolveMediaItem(target, caption, sourceFile, app) {
  if (!target) return null;
  const kind = getMediaKind(target);
  if (!kind) return null;

  if (/^https?:\/\//i.test(target) || /^app:\/\//i.test(target)) {
    return { src: target, kind, caption: String(caption || target), target };
  }

  const linkedFile = app.metadataCache.getFirstLinkpathDest(target, sourceFile.path)
    || app.vault.getAbstractFileByPath(normalizePath(target));
  if (!(linkedFile instanceof TFile)) return null;

  return {
    src: app.vault.getResourcePath(linkedFile),
    kind: getMediaKind(linkedFile.path) || kind,
    caption: String(caption || linkedFile.basename),
    target: linkedFile.path,
  };
}

function cleanMediaTarget(target) {
  const decoded = decodeLinkTarget(String(target || "")
    .trim()
    .replace(/^<|>$/g, ""));
  if (/^https?:\/\//i.test(decoded)) return decoded;
  return decoded.split("#")[0].split("?")[0];
}

function getMediaKind(target) {
  const text = String(target);
  const formatMatch = text.match(/[?&]format=(png|jpe?g|gif|webp|svg|avif|heic|mp4|mov|m4v|webm|mp3|m4a|wav|flac|aac)\b/i);
  const ext = (formatMatch ? formatMatch[1] : text.split("#")[0].split("?")[0].split(".").pop()).toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "heic"].includes(ext)) return "image";
  if (["mp4", "mov", "m4v", "webm", "ogv", "ogg"].includes(ext)) return "video";
  if (["mp3", "m4a", "wav", "flac", "aac"].includes(ext)) return "audio";
  return "";
}

function assignMediaToSections(sections, mediaItems, heroMedia) {
  const pool = mediaItems.filter((item) => !heroMedia || item.src !== heroMedia.src);
  const buckets = sections.map(() => []);
  if (!pool.length || !sections.length) return buckets;

  pool.forEach((item, itemIndex) => {
    const directIndex = sections.findIndex((section) => mediaMatchesSection(item, section));
    const targetIndex = directIndex >= 0
      ? directIndex
      : Math.min(sections.length - 1, Math.floor((itemIndex / pool.length) * sections.length));
    buckets[targetIndex].push(item);
  });

  return buckets;
}

function mediaMatchesSection(item, section) {
  const mediaText = normalizeMatchText([item.heading, item.subheading, item.caption].filter(Boolean).join(" "));
  if (!mediaText) return false;
  const sectionText = normalizeMatchText([
    section.title,
    section.intro,
    ...section.items.map((entry) => entry.title),
  ].filter(Boolean).join(" "));
  return textOverlaps(mediaText, sectionText);
}

function assignMediaToItems(items, mediaItems) {
  const buckets = items.map(() => []);
  if (!mediaItems.length || !items.length) return buckets;

  mediaItems.forEach((media, mediaIndex) => {
    const directIndex = items.findIndex((item) => {
      const mediaText = normalizeMatchText([media.subheading, media.caption].filter(Boolean).join(" "));
      const itemText = normalizeMatchText([item.title, item.body].filter(Boolean).join(" "));
      return textOverlaps(mediaText, itemText);
    });
    const targetIndex = directIndex >= 0
      ? directIndex
      : Math.min(items.length - 1, Math.floor((mediaIndex / mediaItems.length) * items.length));
    buckets[targetIndex].push(media);
  });

  return buckets;
}

function textOverlaps(left, right) {
  if (!left || !right) return false;
  if (left.includes(right) || right.includes(left)) return true;
  const leftTokens = left.match(/[\u4e00-\u9fa5]{2,}|[a-z0-9]{3,}/g) || [];
  return leftTokens.some((token) => right.includes(token));
}

function normalizeMatchText(value) {
  return stripMarkdownInline(String(value || ""))
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]+/g, "");
}

function renderMediaStrip(items, className) {
  if (!items.length) return "";
  const single = items.length === 1 ? " is-single" : "";
  return `<div class="${escapeHtml(className)}${single}">${items.map((item) => renderMediaFigure(item, "media-card")).join("")}</div>`;
}

function renderMediaFigure(item, className) {
  const caption = cleanMediaCaption(item);
  const alt = caption || genericMediaAlt(item);
  const media = item.kind === "video"
    ? `<video controls playsinline src="${escapeHtml(item.src)}"></video>`
    : item.kind === "audio"
      ? `<audio controls src="${escapeHtml(item.src)}"></audio>`
      : `<img src="${escapeHtml(item.src)}" alt="${escapeHtml(alt)}" loading="lazy">`;
  return `<figure class="${escapeHtml(className)}">${media}${caption ? `<figcaption>${renderInline(caption)}</figcaption>` : ""}</figure>`;
}

function cleanMediaCaption(item) {
  const caption = stripMarkdownInline(String(item.caption || ""));
  if (!caption || isGenericMediaCaption(caption, item)) return "";
  return caption;
}

function genericMediaAlt(item) {
  return item.kind === "video" ? "视频" : item.kind === "audio" ? "音频" : "图片";
}

function isGenericMediaCaption(caption, item) {
  const text = String(caption || "").trim();
  if (!text) return true;
  if (/^(image|img|screenshot|screen shot|截图|图片|视频|音频)$/i.test(text)) return true;
  if (/^(https?:\/\/|app:\/\/|file:\/\/)/i.test(text)) return true;
  if (/[\\/]/.test(text) && /\.(png|jpe?g|gif|webp|svg|avif|heic|mp4|mov|m4v|webm|mp3|m4a|wav|flac|aac)(?:$|[?#])/i.test(text)) return true;
  if (/^\S+\.(png|jpe?g|gif|webp|svg|avif|heic|mp4|mov|m4v|webm|mp3|m4a|wav|flac|aac)$/i.test(text)) return true;
  if (item?.target && text === item.target) return true;
  return false;
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function extractMeta(markdown, file) {
  const withoutFrontmatter = markdown.replace(/^---[\s\S]*?---\s*/, "").trim();
  const heading = withoutFrontmatter.match(/^#\s+(.+)$/m);
  const title = stripMarkdownInline(heading ? heading[1] : file.basename);
  const firstParagraph = withoutFrontmatter
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .find((part) => part && !part.startsWith("#") && !part.startsWith("```") && !part.startsWith("![["));
  return {
    title,
    summary: firstParagraph ? stripMarkdownInline(firstParagraph).slice(0, 160) : "",
  };
}

function polishRenderedHtml(renderedHtml) {
  const body = document.createElement("div");
  body.innerHTML = renderedHtml;

  body.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading, index) => {
    if (!heading.id) heading.id = `section-${index + 1}`;
  });

  body.querySelectorAll("table").forEach((table) => {
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrap";
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });

  body.querySelectorAll("blockquote").forEach((quote) => {
    const text = quote.textContent.trim();
    const callout = text.match(/^\[!(\w+)\]\s*([^\n]*)/);
    if (callout) {
      quote.classList.add("callout", `callout-${callout[1].toLowerCase()}`);
      const first = quote.querySelector("p");
      if (first) {
        first.innerHTML = first.innerHTML.replace(/^\[!\w+\]\s*/, "");
        first.classList.add("callout-title");
      }
    } else {
      quote.classList.add("pull-quote");
    }
  });

  body.querySelectorAll("ul, ol").forEach((list) => {
    if (list.parentElement && list.parentElement.tagName === "LI") return;
    if (list.children.length >= 3) list.classList.add("list-panel");
  });

  body.querySelectorAll("img").forEach((img) => {
    img.loading = "lazy";
    img.decoding = "async";
  });

  return body;
}

function buildToc(body) {
  const headings = Array.from(body.querySelectorAll("h2, h3")).slice(0, 12);
  if (headings.length < 2) return "";
  const items = headings
    .map((heading) => {
      const cls = heading.tagName === "H3" ? "toc-sub" : "";
      return `<a class="${cls}" href="#${escapeHtml(heading.id)}">${escapeHtml(heading.textContent.trim())}</a>`;
    })
    .join("");
  return `<nav class="toc" aria-label="目录"><div class="toc-label">目录</div>${items}</nav>`;
}

function stripMarkdownInline(text) {
  return text
    .replace(/!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`~=#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function decodeLinkTarget(value) {
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  try {
    return decodeURIComponent(trimmed);
  } catch (error) {
    return trimmed;
  }
}

async function ensureFolder(app, folderPath) {
  const parts = normalizePath(folderPath).split("/");
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) {
      await app.vault.createFolder(current);
    }
  }
}

function documentCss() {
  return `
:root {
  color-scheme: light;
  --paper: #f7f1e8;
  --panel: #fffaf2;
  --ink: #27231f;
  --muted: #766f66;
  --line: #e4d8c8;
  --accent: #2f6f73;
  --accent-2: #b85b45;
  --accent-3: #e5b94f;
  --code: #263238;
  --shadow: 0 22px 60px rgba(80, 55, 28, 0.12);
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", "PingFang SC", sans-serif;
  line-height: 1.78;
}
.page {
  width: min(100%, 1080px);
  margin: 0 auto;
  padding: 56px 24px 80px;
}
.hero {
  border-bottom: 2px solid var(--ink);
  padding: 28px 0 34px;
}
.kicker {
  color: var(--accent-2);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}
h1 {
  max-width: 920px;
  margin: 14px 0 16px;
  font-family: "Songti SC", "Noto Serif SC", STSong, serif;
  font-size: clamp(36px, 7vw, 76px);
  line-height: 1.05;
  font-weight: 800;
  letter-spacing: 0;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
}
.meta span {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 3px 10px;
  background: rgba(255, 250, 242, 0.7);
}
.summary {
  max-width: 760px;
  margin: 22px 0 0;
  color: #4c443d;
  font-size: 18px;
}
.toc {
  display: grid;
  grid-template-columns: 80px repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px 14px;
  margin: 26px 0;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 250, 242, 0.72);
  box-shadow: var(--shadow);
}
.toc-label {
  color: var(--accent);
  font-weight: 800;
}
.toc a {
  color: var(--ink);
  text-decoration: none;
}
.toc a:hover { color: var(--accent-2); }
.toc-sub { color: var(--muted) !important; }
.content {
  padding: 36px clamp(18px, 4vw, 58px);
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: var(--shadow);
}
.content > :first-child { margin-top: 0; }
.content h1 {
  margin: 0 0 24px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
  font-size: 34px;
  line-height: 1.2;
}
.content h2 {
  margin: 48px 0 18px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
  font-family: "Songti SC", "Noto Serif SC", STSong, serif;
  font-size: 31px;
  line-height: 1.25;
}
.content h3 {
  margin: 34px 0 12px;
  color: var(--accent);
  font-size: 21px;
  line-height: 1.35;
}
.content h4 {
  margin: 26px 0 10px;
  color: #4c443d;
  font-size: 17px;
}
p { margin: 0 0 18px; }
a { color: var(--accent); text-underline-offset: 3px; }
strong { color: #191613; }
mark {
  border-radius: 4px;
  padding: 1px 4px;
  background: rgba(229, 185, 79, 0.35);
}
.list-panel {
  margin: 20px 0;
  padding: 18px 22px 18px 34px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff6e8;
}
li { margin: 6px 0; }
blockquote {
  margin: 26px 0;
  padding: 18px 22px;
  border-left: 5px solid var(--accent);
  border-radius: 8px;
  background: #f1f7f2;
}
.pull-quote {
  color: #34433c;
  font-family: "Songti SC", "Noto Serif SC", STSong, serif;
  font-size: 18px;
}
.callout {
  border-left-color: var(--accent-2);
  background: #fff0e8;
}
.callout-title {
  color: var(--accent-2);
  font-weight: 800;
}
.table-wrap {
  overflow-x: auto;
  margin: 24px 0;
  border: 1px solid var(--line);
  border-radius: 8px;
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 560px;
  background: white;
}
th, td {
  border-bottom: 1px solid var(--line);
  padding: 12px 14px;
  text-align: left;
  vertical-align: top;
}
th {
  background: #f0e6d8;
  color: #332b25;
  font-weight: 800;
}
tr:last-child td { border-bottom: 0; }
code {
  border-radius: 5px;
  padding: 2px 5px;
  background: #efe7dc;
  color: var(--code);
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 0.92em;
}
pre {
  overflow-x: auto;
  margin: 24px 0;
  padding: 18px;
  border-radius: 8px;
  background: #202124;
  color: #f6f0e8;
}
pre code {
  padding: 0;
  background: transparent;
  color: inherit;
}
img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 28px auto;
  border-radius: 8px;
  box-shadow: 0 16px 42px rgba(38, 30, 24, 0.14);
}
.ai-polished {
  --paper: #f4f6f1;
  --panel: #fffdf7;
  --line: #dce6dc;
  --accent: #1f7a68;
  --accent-2: #9b6a2d;
  --accent-3: #d9c76b;
  background:
    radial-gradient(circle at 12% 0%, rgba(228, 211, 112, 0.18), transparent 28%),
    linear-gradient(180deg, #fbfcf8 0%, #f2f6f1 48%, #eef3ed 100%);
}
.ai-polished .page {
  width: min(100%, 1120px);
}
.ai-polished .hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  padding: 34px 0 30px;
  border-bottom: 1px solid rgba(31,122,104,0.22);
}
.ai-polished .kicker {
  display: inline-flex;
  width: fit-content;
  border: 1px solid rgba(31,122,104,0.18);
  border-radius: 999px;
  padding: 5px 11px;
  background: rgba(255,255,255,0.68);
  color: var(--accent);
}
.ai-polished h1 {
  font-size: clamp(34px, 5.2vw, 62px);
}
.ai-polished .meta span {
  background: rgba(255,255,255,0.7);
}
.ai-polished .summary {
  max-width: 820px;
  border-left: 3px solid rgba(31,122,104,0.45);
  padding-left: 16px;
  color: #48564f;
}
.ai-polished .toc {
  border-color: rgba(31,122,104,0.15);
  background: rgba(255,255,255,0.78);
  box-shadow: 0 16px 46px rgba(42,72,58,0.08);
}
.ai-polished .content {
  border-color: rgba(31,122,104,0.14);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,253,247,0.96)),
    var(--panel);
  box-shadow: 0 20px 58px rgba(42,72,58,0.1);
}
.ai-polished .content h2 {
  margin: 44px 0 18px;
  padding: 16px 18px;
  border: 1px solid rgba(31,122,104,0.13);
  border-left: 5px solid var(--accent);
  border-radius: 8px;
  background: #f3faf5;
  font-size: 28px;
}
.ai-polished .content h3 {
  display: inline-flex;
  margin-top: 30px;
  border-bottom: 2px solid rgba(217,199,107,0.55);
  color: #1f5f55;
}
.ai-polished .list-panel {
  padding: 18px 20px 18px 26px;
  border-color: rgba(31,122,104,0.14);
  background: #f6fbf6;
}
.ai-polished blockquote {
  border-left-width: 4px;
  border-left-color: var(--accent);
  background: #edf8f1;
}
.ai-polished .pull-quote {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", "PingFang SC", sans-serif;
  font-size: 17px;
  font-weight: 750;
}
.ai-polished img {
  box-shadow: 0 18px 48px rgba(42,72,58,0.12);
}
hr {
  margin: 36px 0;
  border: 0;
  border-top: 1px solid var(--line);
}
.task-list-item-checkbox { margin-right: 8px; }
@media (max-width: 720px) {
  .page { padding: 28px 14px 48px; }
  .content { padding: 24px 18px; }
  .toc { grid-template-columns: 1fr; }
  h1 { font-size: 38px; }
}
`;
}

function webifiedDocumentCss() {
  return `
:root {
  color-scheme: light;
  --bg: #f3f6f4;
  --paper: #fffdf7;
  --ink: #172026;
  --muted: #68747b;
  --line: #dde6e1;
  --green: #1e9c68;
  --teal: #0f6f75;
  --lemon: #ead16a;
  --soft: #f7faf8;
  --shadow: 0 18px 54px rgba(39, 65, 70, 0.1);
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: linear-gradient(180deg, #fbfdfb 0%, var(--bg) 42%, #eef4f1 100%);
  color: var(--ink);
  font-family: "Avenir Next", "PingFang SC", "Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif;
  line-height: 1.72;
}
.site-nav {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 60px;
  padding: 0 clamp(18px, 4vw, 42px);
  border-bottom: 1px solid rgba(21,32,40,0.08);
  background: rgba(246, 250, 248, 0.86);
  backdrop-filter: blur(16px);
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
  color: var(--ink);
  text-decoration: none;
  font-weight: 800;
  max-width: 260px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.brand span {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  flex: 0 0 auto;
  background: linear-gradient(135deg, var(--lemon), #bce9ca 65%, #d7f2ff);
  box-shadow: 0 10px 24px rgba(32,166,106,0.2);
}
.site-nav nav {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 16px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  white-space: nowrap;
}
.site-nav nav::-webkit-scrollbar { display: none; }
.site-nav nav a {
  color: #51606a;
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}
.site-nav nav a:hover { color: var(--teal); }
main {
  width: min(100%, 1080px);
  margin: 0 auto;
  padding: 42px 22px 78px;
}
.web-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.95fr);
  gap: clamp(22px, 4vw, 48px);
  align-items: stretch;
  min-height: 380px;
  padding: 28px 0 46px;
}
.eyebrow {
  color: var(--teal);
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}
.web-hero h1 {
  max-width: 720px;
  margin: 18px 0;
  font-family: "Songti SC", "Noto Serif SC", STSong, serif;
  font-size: clamp(38px, 6.2vw, 70px);
  line-height: 1.05;
  letter-spacing: 0;
}
.hero-summary {
  max-width: 760px;
  color: #45535a;
  font-size: clamp(17px, 2.1vw, 21px);
  font-weight: 600;
}
.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}
.hero-meta span {
  border: 1px solid rgba(21,32,40,0.1);
  border-radius: 999px;
  padding: 7px 12px;
  background: rgba(255,255,255,0.62);
  color: var(--muted);
  font-size: 13px;
}
.hero-panel {
  position: relative;
  align-self: stretch;
  min-height: 280px;
  padding: 16px;
  border: 1px solid rgba(21,32,40,0.1);
  border-radius: 8px;
  background: rgba(255,255,255,0.82);
  box-shadow: var(--shadow);
}
.hero-panel h2 {
  position: relative;
  margin: 18px 10px 14px;
  font-size: 20px;
}
.hero-panel ul {
  position: relative;
  display: grid;
  gap: 10px;
  margin: 0 10px 10px;
  padding: 0;
  list-style: none;
}
.hero-panel li {
  padding: 11px 13px;
  border-radius: 8px;
  background: #f5f9f6;
  font-weight: 700;
  font-size: 14px;
}
.hero-media {
  margin: 0;
  overflow: hidden;
  border-radius: 8px;
  background: #f6f3ea;
}
.hero-media img {
  display: block;
  width: 100%;
  max-height: 360px;
  object-fit: contain;
}
.hero-media figcaption {
  padding: 10px 12px;
  color: var(--muted);
  font-size: 12px;
}
.web-section {
  margin: 26px 0;
  padding: clamp(22px, 3.4vw, 34px);
  border: 1px solid rgba(21,32,40,0.09);
  border-radius: 8px;
  background: rgba(255,255,255,0.76);
  box-shadow: 0 14px 38px rgba(50,65,70,0.06);
}
.section-head {
  display: grid;
  grid-template-columns: 58px minmax(0, 0.88fr) minmax(240px, 1fr);
  gap: 18px;
  align-items: start;
  margin-bottom: 26px;
}
.section-head > p:first-child {
  margin: 6px 0 0;
  color: var(--green);
  font-weight: 900;
}
.section-head h2 {
  margin: 0;
  font-family: "Songti SC", "Noto Serif SC", STSong, serif;
  font-size: clamp(28px, 3.2vw, 42px);
  line-height: 1.14;
}
.section-head div {
  color: #52606a;
  font-size: 15px;
}
.split-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 26px;
}
.split-main {
  padding: 24px;
  border-radius: 8px;
  background: var(--paper);
}
.insight-note {
  position: relative;
  margin: 24px 0 0;
  padding: 18px 20px 18px 24px;
  border: 1px solid rgba(30,156,104,0.16);
  border-radius: 8px;
  background:
    linear-gradient(90deg, rgba(30,156,104,0.12), rgba(30,156,104,0) 38%),
    rgba(248,252,249,0.94);
  color: #263b34;
}
.insight-note::before {
  content: "";
  position: absolute;
  left: 0;
  top: 18px;
  bottom: 18px;
  width: 3px;
  border-radius: 999px;
  background: linear-gradient(180deg, #28b47a, #92d6b8);
}
.insight-note > span {
  display: inline-flex;
  margin-bottom: 10px;
  color: var(--green);
  font-size: 12px;
  font-weight: 900;
}
.insight-note p {
  margin: 0;
  color: #2d443b;
  font-size: 17px;
  line-height: 1.9;
  font-weight: 650;
}
.insight-note p + p {
  margin-top: 10px;
}
.mini-grid,
.card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.mini-grid article,
.web-card,
.step,
.faq-list details {
  border: 1px solid rgba(21,32,40,0.09);
  border-radius: 8px;
  background: rgba(255,255,255,0.78);
}
.mini-grid article,
.web-card {
  padding: 22px;
}
.mini-grid h3,
.web-card h3,
.step h3 {
  margin: 0 0 8px;
  font-size: 20px;
}
.mini-grid p,
.web-card p,
.step p,
.faq-list p {
  margin: 0;
  color: #4e5b62;
}
.smart-list {
  display: grid;
  gap: 14px;
}
.smart-list > p {
  margin: 0;
  color: #4e5b62;
}
.smart-list ol {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.smart-list li {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 12px 13px;
  border: 1px solid rgba(15,111,117,0.1);
  border-radius: 8px;
  background: rgba(246,251,248,0.86);
  color: #4e5b62;
}
.smart-list li > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #e8f7ef;
  color: var(--green);
  font-size: 12px;
  font-weight: 900;
}
.smart-list li > div {
  min-width: 0;
}
.semantic-list ol {
  gap: 12px;
}
.semantic-list li {
  grid-template-columns: minmax(88px, auto) minmax(0, 1fr);
  align-items: start;
  padding: 14px 15px;
  background: rgba(255,255,255,0.72);
}
.semantic-list li > span {
  width: auto;
  min-width: 0;
  height: auto;
  padding: 5px 10px;
  border: 1px solid rgba(30,156,104,0.18);
  border-radius: 999px;
  background: #eefaf3;
  white-space: nowrap;
}
.semantic-list li > div {
  padding-top: 2px;
}
.cards-section .card-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.web-card:nth-child(3n + 1),
.web-card:nth-child(3n + 2),
.web-card:nth-child(3n + 3) { background: rgba(255,255,255,0.82); }
.steps {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.step {
  padding: 20px;
}
.step span {
  display: inline-flex;
  width: auto;
  min-width: 40px;
  height: 30px;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  border: 1px solid rgba(30,156,104,0.2);
  border-radius: 999px;
  padding: 0 12px;
  background: #eefaf3;
  color: var(--green);
  font-size: 12px;
  font-weight: 900;
}
.quote-section .insight-note {
  margin: 0;
  max-width: 920px;
}
.faq-list {
  display: grid;
  gap: 12px;
}
.faq-list details {
  padding: 18px 20px;
}
.faq-list summary {
  cursor: pointer;
  color: var(--ink);
  font-weight: 900;
}
.faq-list p {
  margin-top: 12px;
}
.text-panel {
  padding: 28px;
  border-radius: 8px;
  background: var(--paper);
}
.section-media,
.inline-media {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.section-media {
  margin-top: 20px;
}
.inline-media {
  margin-top: 16px;
}
.section-media.is-single,
.inline-media.is-single {
  grid-template-columns: 1fr;
}
.media-card {
  margin: 0;
  overflow: hidden;
  border: 1px solid rgba(21,32,40,0.09);
  border-radius: 8px;
  background: rgba(255,255,255,0.82);
  box-shadow: 0 16px 42px rgba(50,65,70,0.08);
}
.media-card img,
.media-card video {
  display: block;
  width: 100%;
  max-height: 420px;
  object-fit: contain;
  background: #f6f3ea;
}
.inline-media .media-card img,
.inline-media .media-card video {
  max-height: 260px;
}
.media-card audio {
  display: block;
  width: calc(100% - 28px);
  margin: 20px 14px;
}
.media-card figcaption {
  padding: 10px 13px 12px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}
p { margin: 0 0 14px; }
a { color: var(--teal); text-underline-offset: 3px; font-weight: 750; }
.num-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.45em;
  height: 1.45em;
  margin: 0 0.08em;
  border: 1px solid rgba(15,111,117,0.16);
  border-radius: 999px;
  background: #eef8f7;
  color: var(--teal);
  font-size: 0.72em;
  font-weight: 900;
  vertical-align: 0.08em;
}
code {
  border-radius: 5px;
  padding: 2px 5px;
  background: rgba(21,32,40,0.08);
}
.inline-asset {
  display: inline-block;
  border-radius: 6px;
  padding: 2px 7px;
  background: #eef7ff;
  color: #31546f;
  font-size: 0.92em;
}
@media (max-width: 900px) {
  .site-nav { align-items: flex-start; flex-direction: column; padding: 16px 20px; }
  .site-nav nav { justify-content: flex-start; }
  main { padding: 28px 16px 58px; }
  .web-hero,
  .section-head,
  .split-grid { grid-template-columns: 1fr; }
  .cards-section .card-grid,
  .mini-grid,
  .section-media,
  .inline-media,
  .steps { grid-template-columns: 1fr; }
  .web-hero h1 { font-size: 44px; }
}
`;
}
