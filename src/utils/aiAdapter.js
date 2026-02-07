/**
 * AIAdapter - 通用 AI 接口适配器
 * 支持多种 AI 服务商：OpenAI、Claude、Gemini、Azure、自定义等
 *
 * 特性：
 * - 统一的 API 调用接口
 * - 支持流式输出
 * - 可自定义配置
 * - 自动重试机制
 * - AI分析流水线支持（链接识别→严格分词）
 * - 链接补全与上下文推断
 */

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG = {
  // OpenAI
  openai: {
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    apiKey: "",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    headers: {},
    requestFormat: "openai",
    responseFormat: "openai",
  },

  // Claude (Anthropic)
  claude: {
    name: "Claude",
    baseURL: "https://api.anthropic.com/v1",
    apiKey: "",
    defaultModel: "claude-3-5-sonnet-20241022",
    models: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
    ],
    headers: {
      "anthropic-version": "2023-06-01",
    },
    requestFormat: "claude",
    responseFormat: "claude",
  },

  // Google Gemini
  gemini: {
    name: "Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: "",
    defaultModel: "gemini-1.5-flash",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"],
    headers: {},
    requestFormat: "gemini",
    responseFormat: "gemini",
  },

  // Azure OpenAI
  azure: {
    name: "Azure OpenAI",
    baseURL: "",
    apiKey: "",
    defaultModel: "gpt-4",
    models: ["gpt-4", "gpt-4o", "gpt-35-turbo"],
    headers: {},
    requestFormat: "openai",
    responseFormat: "openai",
  },

  // 自定义接口
  custom: {
    name: "自定义",
    baseURL: "",
    apiKey: "",
    defaultModel: "",
    models: [],
    headers: {},
    requestFormat: "openai",
    responseFormat: "openai",
  },
};

// ============================================================================
// 预设配置模板（前置定义，避免前向引用）
// ============================================================================

const ProviderTemplates = {
  openaiCompatible: {
    name: "OpenAI 兼容",
    requestFormat: "openai",
    responseFormat: "openai",
    headers: {},
  },

  ollama: {
    name: "Ollama",
    baseURL: "http://localhost:11434/v1",
    requestFormat: "openai",
    responseFormat: "openai",
    defaultModel: "llama2",
    models: ["llama2", "mistral", "codellama", "qwen"],
  },

  zhipu: {
    name: "智谱 AI",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    requestFormat: "openai",
    responseFormat: "openai",
    defaultModel: "glm-4",
    models: ["glm-4", "glm-4-plus", "glm-4-flash"],
  },

  wenxin: {
    name: "百度文心",
    baseURL: "https://qianfan.baidubce.com/v2",
    requestFormat: "openai",
    responseFormat: "openai",
    defaultModel: "ernie-4.0-turbo-8k",
    models: ["ernie-4.0-turbo-8k", "ernie-3.5-128k"],
  },

  qwen: {
    name: "阿里通义",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    requestFormat: "openai",
    responseFormat: "openai",
    defaultModel: "qwen-turbo",
    models: ["qwen-max", "qwen-plus", "qwen-turbo"],
  },

  deepseek: {
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    requestFormat: "openai",
    responseFormat: "openai",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-coder"],
  },

  siliconflow: {
    name: "SiliconFlow",
    baseURL: "https://api.siliconflow.cn/v1",
    requestFormat: "openai",
    responseFormat: "openai",
    defaultModel: "Qwen/Qwen2.5-7B-Instruct",
    models: ["Qwen/Qwen2.5-7B-Instruct", "deepseek-ai/DeepSeek-V2.5"],
  },
};

// ============================================================================
// 预设 System Prompt 角色配置（前置定义）
// ============================================================================

const SystemPrompts = {
  tokenizer: `你是一个混合文本分词器。你的任务是将输入文本切分成词语列表。

【核心规则】
1. 只返回分词结果列表，格式为 JSON 数组
2. 不对文本内容进行任何解释、分析或评论
3. 保持文本原样，不增删改任何字符
4. 对文本保持完全客观和旁观态度

【输出格式】
["词语1", "词语2", "词语3", ...]

【禁止事项】
- 禁止输出任何解释性文字
- 禁止输出 markdown 代码块标记
- 禁止添加序号、标题或说明
- 禁止对文本内容进行评价

示例输入：今天天气真好
示例输出：["今天", "天气", "真好"]`,

  strictTokenizer: `你是一个严格分词器。你的任务是对输入文本进行严格分词。

【严格分词规则】
1. 中文字符：每个汉字独立成格
2. 英文字母：按单词分格（连续字母为一个词）
3. 数字：连续数字作为一格
4. 标点：每个标点符号独立成格
5. 空格：全部去除，不参与分词
6. 保持原文顺序，不改变字符位置

【输出格式】
["中", "文", "字", "符", "English", "123", "，", "."]

【禁止事项】
- 禁止输出任何解释
- 禁止使用 markdown 代码块
- 禁止改变字符顺序
- 禁止合并连续字符（除非是单词）

示例输入：Hello世界123！
示例输出：["Hello", "世", "界", "123", "！"]`,

  linkDetector: `你是一个链接检测助手。你的任务是从文本中识别并补全链接。

【识别规则】
1. 完整URL：http://, https://, ftp:// 开头的地址
2. 疑似域名：example.com, example.org 等常见域名格式

【补全规则】
1. 有上下文URL时，继承其协议头（http:// 或 https://）
2. 无上下文时，默认使用 https://
3. Visit example.com or example.org → 两个都补全为完整URL

【输出格式】
JSON对象：
{
  "links": ["完整URL列表"],
  "suspectLinks": ["补全后的域名列表"],
  "contextProtocol": "从上下文推断的协议头"
}

【示例】
输入：Check http://test.com and example.net
输出：{"links": ["http://test.com"], "suspectLinks": ["http://example.net"], "contextProtocol": "http://"}`,
};

// ============================================================================
// URL与链接处理工具
// ============================================================================

/**
 * URL模式正则 - 识别完整URL
 * 支持：http://, https://, ftp:// 等协议
 */
const URL_PATTERN =
  /https?:\/\/[^\s<>"{}|\\^`\[\]]+|ftp:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

/**
 * 域名模式正则 - 识别疑似链接
 * 匹配：example.com, example.org 等
 * 排除：version, release 等常见词汇
 */
const SUSPECT_LINK_REGEX =
  /\b([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]?\.)+(com|org|net|cn|io|cc|co|gov|edu|app|dev|info|xyz|top|online|site)\b/i;

/**
 * 域名黑名单 - 排除误判
 */
const DOMAIN_BLACKLIST = new Set([
  "version",
  "release",
  "chapter",
  "section",
  "figure",
  "table",
  "algorithm",
  "function",
  "method",
  "class",
  "object",
  "property",
  "copyright",
  "trademark",
  "trademarked",
  "registered",
]);

/**
 * 检测文本中的完整URL
 * @param {string} text 输入文本
 * @returns {Array} URL数组（按出现顺序）
 */
export function extractURLs(text) {
  const urls = [];
  const matches = text.match(URL_PATTERN) || [];

  for (const url of matches) {
    try {
      new URL(url);
      urls.push(url);
    } catch {
      // 无效URL，跳过
    }
  }

  return urls;
}

/**
 * 检测文本中的疑似链接（域名模式）
 * @param {string} text 输入文本
 * @returns {Array} 疑似链接数组（按出现顺序）
 */
export function extractSuspectLinks(text) {
  const links = [];
  const matches = text.match(SUSPECT_LINK_REGEX) || [];

  for (const match of matches) {
    const domain = match.toLowerCase();
    // 排除黑名单词汇
    if (DOMAIN_BLACKLIST.has(domain.split(".")[0])) {
      continue;
    }
    links.push(match);
  }

  return links;
}

/**
 * 从上下文推断协议头
 * @param {string} text 完整文本
 * @param {number} position 当前查找位置
 * @returns {string} 推断的协议头
 */
export function inferProtocolFromContext(text, position) {
  const prefix = text.substring(0, position);
  const urlMatches = prefix.match(/https?:\/\//gi);

  if (urlMatches && urlMatches.length > 0) {
    return urlMatches[urlMatches.length - 1];
  }

  // 无上下文，默认 https://
  return "https://";
}

/**
 * 补全疑似链接
 * @param {string} suspectLink 疑似链接域名
 * @param {string} protocol 协议头
 * @returns {string} 完整URL
 */
export function completeLink(suspectLink, protocol = "https://") {
  if (suspectLink.startsWith("http://") || suspectLink.startsWith("https://")) {
    return suspectLink;
  }
  return `${protocol}${suspectLink}`;
}

/**
 * AI分析链接处理流水线
 *
 * 处理流程：
 * 1. 链接识别：提取所有URL模式（http://, https://, ftp://等）
 * 2. 疑似链接识别：检测域名模式（example.com, example.org等）
 * 3. 上下文补全：根据最近完整链接的协议头补全疑似链接
 * 4. 文本重组：将原文本中的链接位置替换为占位符{{LINK_N}}
 * 5. 严格分词：对非链接文本进行标准分词
 * 6. 输出排序：链接片段（按出现顺序）→ 补全链接 → 分词结果
 *
 * @param {string} text 输入文本
 * @param {object} options 配置选项
 * @returns {Promise<object>} 处理结果
 */
export async function aiAnalyzePipeline(text, options = {}) {
  const {
    protocol = "https://",
    enableStrictTokenization = true,
    provider = "openai",
    baseURL = "",
    apiKey = "",
    model = "",
  } = options;

  // 阶段1：链接识别
  const urls = extractURLs(text);

  // 阶段2：疑似链接识别
  const suspectLinks = extractSuspectLinks(text);

  // 阶段3：上下文补全
  const completedLinks = [];
  let lastUrlPosition = 0;

  for (const link of suspectLinks) {
    const position = text.indexOf(link, lastUrlPosition);
    const inferredProtocol = inferProtocolFromContext(text, position);
    completedLinks.push(completeLink(link, inferredProtocol));
  }

  // 边界处理：无上下文链接，使用默认协议
  if (urls.length === 0 && completedLinks.length > 0) {
    for (let i = 0; i < completedLinks.length; i++) {
      if (!completedLinks[i].startsWith("http")) {
        completedLinks[i] = `${protocol}${completedLinks[i]}`;
      }
    }
  }

  // 阶段4：文本重组（将链接替换为占位符）
  let restructuredText = text;
  const linkPlaceholders = [];
  let linkIndex = 0;

  // 去重并合并链接列表
  const allLinks = [...new Set([...urls, ...suspectLinks])];

  // 按长度降序排序，避免短链接替换影响长链接
  allLinks.sort((a, b) => b.length - a.length);

  for (const link of allLinks) {
    const placeholder = `{{LINK_${linkIndex}}}`;
    linkPlaceholders.push({ placeholder, original: link });
    // 使用正则表达式进行全局替换，避免只替换第一个匹配项
    const escapedLink = link.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    restructuredText = restructuredText.replace(
      new RegExp(escapedLink, "g"),
      placeholder,
    );
    linkIndex++;
  }

  // 阶段5：严格分词（调用AI）
  let tokenizedResult = [];
  if (enableStrictTokenization && restructuredText.trim()) {
    const adapterConfig = {
      providers: {
        [provider]: {
          name: ProviderTemplates[provider]?.name || "自定义",
          baseURL:
            baseURL ||
            ProviderTemplates[provider]?.baseURL ||
            DEFAULT_CONFIG[provider]?.baseURL ||
            "",
          apiKey: apiKey || "",
          defaultModel:
            model ||
            ProviderTemplates[provider]?.defaultModel ||
            DEFAULT_CONFIG[provider]?.defaultModel ||
            "",
          models:
            ProviderTemplates[provider]?.models ||
            DEFAULT_CONFIG[provider]?.models ||
            [],
          requestFormat:
            ProviderTemplates[provider]?.requestFormat ||
            DEFAULT_CONFIG[provider]?.requestFormat ||
            "openai",
          responseFormat:
            ProviderTemplates[provider]?.responseFormat ||
            DEFAULT_CONFIG[provider]?.responseFormat ||
            "openai",
          headers:
            ProviderTemplates[provider]?.headers ||
            DEFAULT_CONFIG[provider]?.headers ||
            {},
        },
      },
      defaultProvider: provider,
    };

    const adapter = new AIAdapter(adapterConfig);
    const tokenizerPrompt = SystemPrompts.strictTokenizer;

    const response = await adapter.simpleChat(restructuredText, {
      systemPrompt: tokenizerPrompt,
      temperature: 0.1,
      maxTokens: 4096,
    });

    try {
      // 尝试解析JSON数组
      const parsed = JSON.parse(response);
      tokenizedResult = Array.isArray(parsed) ? parsed : [restructuredText];
    } catch {
      // 解析失败，返回原文
      tokenizedResult = [restructuredText];
    }
  }

  // 阶段6：输出排序
  // 链接片段（按出现顺序）→ 补全链接 → 分词结果
  const orderedResults = [
    ...urls,
    ...completedLinks.filter((l) => !urls.includes(l)),
    ...tokenizedResult.filter((t) => !t.startsWith("{{LINK_")),
  ];

  return {
    links: urls,
    suspectLinks: completedLinks,
    restructuredText,
    placeholders: linkPlaceholders,
    tokenizedResult: orderedResults,
    pipeline: {
      step1_urls: urls.length,
      step2_suspectLinks: suspectLinks.length,
      step3_completed: completedLinks.length,
      step4_restructured: !!restructuredText,
      step5_tokenized: tokenizedResult.length,
      step6_ordered: orderedResults.length,
    },
  };
}

// ============================================================================
// 请求格式转换器
// ============================================================================

const RequestFormatters = {
  openai: (messages, model, options = {}) => {
    const validMessages = messages
      .filter(
        (m) => m && m.role && m.content !== undefined && m.content !== null,
      )
      .map((m) => ({
        role: m.role,
        content: String(m.content),
      }));

    return {
      model,
      messages: validMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: options.stream ?? false,
      ...options.extraParams,
    };
  },

  claude: (messages, model, options = {}) => {
    const validMessages = messages.filter(
      (m) => m && m.role && m.content !== undefined && m.content !== null,
    );
    const systemMessage = validMessages.find((m) => m.role === "system");
    const userMessages = validMessages.filter((m) => m.role !== "system");

    return {
      model,
      messages: userMessages.map((m) => ({
        role: m.role,
        content: String(m.content),
      })),
      system: systemMessage?.content
        ? String(systemMessage.content)
        : undefined,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: options.stream ?? false,
      ...options.extraParams,
    };
  },

  gemini: (messages, model, options = {}) => {
    const validMessages = messages.filter(
      (m) => m && m.role && m.content !== undefined && m.content !== null,
    );
    const contents = validMessages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: String(m.content) }],
    }));

    return {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
        ...options.extraParams,
      },
    };
  },
};

// ============================================================================
// 响应解析器
// ============================================================================

const ResponseParsers = {
  openai: async (response) => {
    const data = await response.json();

    if (data.error) {
      throw new AIError(data.error.message, data.error.code, data.error.type);
    }

    if (!data.choices || data.choices.length === 0) {
      return {
        content: "",
        usage: data.usage,
        model: data.model,
        finishReason: "stop",
        raw: data,
      };
    }

    return {
      content: data.choices[0]?.message?.content || "",
      usage: data.usage,
      model: data.model,
      finishReason: data.choices[0]?.finish_reason,
      raw: data,
    };
  },

  claude: async (response) => {
    const data = await response.json();

    if (data.error) {
      throw new AIError(data.error.message, data.error.type);
    }

    if (!data.content || data.content.length === 0) {
      return {
        content: "",
        usage: data.usage,
        model: data.model,
        finishReason: data.stop_reason || "stop",
        raw: data,
      };
    }

    return {
      content: data.content[0]?.text || "",
      usage: data.usage,
      model: data.model,
      finishReason: data.stop_reason,
      raw: data,
    };
  },

  gemini: async (response) => {
    const data = await response.json();

    if (data.error) {
      throw new AIError(data.error.message, data.error.code);
    }

    if (!data.candidates || data.candidates.length === 0) {
      return {
        content: "",
        usage: data.usageMetadata,
        model: data.modelVersion,
        finishReason: "stop",
        raw: data,
      };
    }

    const candidate = data.candidates[0];

    return {
      content: candidate?.content?.parts?.[0]?.text || "",
      usage: data.usageMetadata,
      model: data.modelVersion,
      finishReason: candidate?.finishReason,
      raw: data,
    };
  },
};

// ============================================================================
// 流式响应处理器
// ============================================================================

const StreamHandlers = {
  openai: async (response, onChunk) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || "";
            if (content) {
              onChunk(content, parsed);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  },

  claude: async (response, onChunk) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta") {
              const content = parsed.delta?.text || "";
              if (content) {
                onChunk(content, parsed);
              }
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  },

  gemini: async (response, onChunk) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content =
              parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (content) {
              onChunk(content, parsed);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  },
};

// ============================================================================
// 错误类
// ============================================================================

class AIError extends Error {
  constructor(message, code = null, type = null) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.type = type;
  }
}

// 连接测试错误处理辅助函数
function formatConnectionError(error) {
  let errorMsg = "连接失败";
  if (error.name === "TypeError" && error.message.includes("fetch")) {
    errorMsg = "连接失败: 无法连接到服务器，请检查网络或Base URL";
  } else if (error.message) {
    errorMsg = `连接失败: ${error.message}`;
  }
  return errorMsg;
}

// ============================================================================
// AI 适配器类
// ============================================================================

class AIAdapter {
  constructor(config = {}) {
    this.configs = { ...DEFAULT_CONFIG };
    this.activeProvider = "openai";

    if (config.providers) {
      Object.entries(config.providers).forEach(([key, value]) => {
        this.configs[key] = { ...this.configs[key], ...value };
      });
    }

    if (config.defaultProvider) {
      this.activeProvider = config.defaultProvider;
    }
  }

  setProvider(provider) {
    if (!this.configs[provider]) {
      throw new AIError(`未知的服务商: ${provider}`);
    }
    this.activeProvider = provider;
  }

  getCurrentConfig() {
    return this.configs[this.activeProvider];
  }

  updateConfig(provider, config) {
    if (!this.configs[provider]) {
      this.configs[provider] = { ...DEFAULT_CONFIG.custom };
    }
    this.configs[provider] = { ...this.configs[provider], ...config };
  }

  addProvider(name, config) {
    this.configs[name] = {
      ...DEFAULT_CONFIG.custom,
      ...config,
    };
  }

  getProviders() {
    return Object.entries(this.configs).map(([key, config]) => ({
      id: key,
      name: config.name,
      models: config.models,
      defaultModel: config.defaultModel,
    }));
  }

  buildURL(config, model) {
    const format = config.requestFormat;

    switch (format) {
      case "gemini":
        return `${config.baseURL}/models/${model}:generateContent?key=${config.apiKey}`;
      case "openai":
      default:
        if (
          config.baseURL.includes("azure.com") ||
          config.baseURL.includes("deployments")
        ) {
          return `${config.baseURL}/chat/completions?api-version=2024-02-01`;
        }
        return `${config.baseURL}/chat/completions`;
    }
  }

  buildHeaders(config) {
    const headers = {
      "Content-Type": "application/json",
      ...config.headers,
    };

    if (config.requestFormat !== "gemini" && config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    if (config.requestFormat === "claude") {
      headers["x-api-key"] = config.apiKey;
    }

    return headers;
  }

  async chat(messages, options = {}) {
    if (!Array.isArray(messages)) {
      throw new AIError("messages 必须是数组");
    }

    if (messages.length === 0) {
      throw new AIError("messages 不能为空");
    }

    const config = this.getCurrentConfig();
    const model = options.model || config.defaultModel;

    if (!config.baseURL) {
      throw new AIError("未配置 API 地址");
    }

    if (!config.apiKey) {
      throw new AIError("未配置 API Key");
    }

    const url = this.buildURL(config, model);
    const headers = this.buildHeaders(config);

    const formatter =
      RequestFormatters[config.requestFormat] || RequestFormatters.openai;
    const body = formatter(messages, model, options);

    const maxRetries = options.maxRetries ?? 3;
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new AIError(
            errorData.error?.message || `HTTP ${response.status}`,
            response.status,
          );
        }

        if (options.stream && options.onChunk) {
          const handler =
            StreamHandlers[config.responseFormat] || StreamHandlers.openai;
          await handler(response, options.onChunk);
          return { stream: true };
        }

        const parser =
          ResponseParsers[config.responseFormat] || ResponseParsers.openai;
        return await parser(response);
      } catch (error) {
        lastError = error;

        if (error.code === 401 || error.code === 403) {
          throw error;
        }

        if (attempt < maxRetries - 1) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }

    throw lastError;
  }

  async streamChat(messages, onChunk, options = {}) {
    return this.chat(messages, {
      ...options,
      stream: true,
      onChunk,
    });
  }

  async simpleChat(content, options = {}) {
    if (content === undefined || content === null) {
      throw new AIError("content 不能为空");
    }

    const messages = [
      {
        role: "system",
        content: options.systemPrompt || "你是一个 helpful 的助手。",
      },
      { role: "user", content: String(content) },
    ];

    const response = await this.chat(messages, options);
    return response.content;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// 导出
// ============================================================================

const aiAdapter = new AIAdapter();

export {
  AIAdapter,
  aiAdapter,
  AIError,
  ProviderTemplates,
  DEFAULT_CONFIG,
  SystemPrompts,
};

export default aiAdapter;

// 兼容 CommonJS
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    AIAdapter,
    aiAdapter,
    AIError,
    ProviderTemplates,
    DEFAULT_CONFIG,
    SystemPrompts,
    // 链接处理工具
    extractURLs,
    extractSuspectLinks,
    inferProtocolFromContext,
    completeLink,
    aiAnalyzePipeline,
  };
}
