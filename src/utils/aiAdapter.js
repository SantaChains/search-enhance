/**
 * AIAdapter - 通用 AI 接口适配器
 * 支持多种 AI 服务商：OpenAI、Claude、Gemini、Azure、自定义等
 *
 * 特性：
 * - 统一的 API 调用接口
 * - 支持流式输出
 * - 可自定义配置
 * - 自动重试机制
 * - 错误处理
 */

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG = {
  // OpenAI
  openai: {
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    apiKey: '',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    headers: {},
    requestFormat: 'openai',
    responseFormat: 'openai'
  },

  // Claude (Anthropic)
  claude: {
    name: 'Claude',
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: '',
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229'
    ],
    headers: {
      'anthropic-version': '2023-06-01'
    },
    requestFormat: 'claude',
    responseFormat: 'claude'
  },

  // Google Gemini
  gemini: {
    name: 'Gemini',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: '',
    defaultModel: 'gemini-1.5-flash',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
    headers: {},
    requestFormat: 'gemini',
    responseFormat: 'gemini'
  },

  // Azure OpenAI
  azure: {
    name: 'Azure OpenAI',
    baseURL: '', // 需要填写: https://{resource}.openai.azure.com/openai/deployments/{deployment}
    apiKey: '',
    defaultModel: 'gpt-4',
    models: ['gpt-4', 'gpt-4o', 'gpt-35-turbo'],
    headers: {},
    requestFormat: 'openai',
    responseFormat: 'openai'
  },

  // 自定义接口
  custom: {
    name: '自定义',
    baseURL: '',
    apiKey: '',
    defaultModel: '',
    models: [],
    headers: {},
    requestFormat: 'openai', // 默认使用 OpenAI 格式
    responseFormat: 'openai'
  }
};

// ============================================================================
// 请求格式转换器
// ============================================================================

const RequestFormatters = {
  // OpenAI 格式
  openai: (messages, model, options = {}) => {
    const validMessages = messages
      .filter(m => m && m.role && m.content !== undefined && m.content !== null)
      .map(m => ({
        role: m.role,
        content: String(m.content)
      }));

    return {
      model,
      messages: validMessages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: options.stream ?? false,
      ...options.extraParams
    };
  },

  // Claude 格式
  claude: (messages, model, options = {}) => {
    const validMessages = messages.filter(m => m && m.role && m.content !== undefined && m.content !== null);
    const systemMessage = validMessages.find(m => m.role === 'system');
    const userMessages = validMessages.filter(m => m.role !== 'system');

    return {
      model,
      messages: userMessages.map(m => ({
        role: m.role,
        content: String(m.content)
      })),
      system: systemMessage?.content ? String(systemMessage.content) : undefined,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: options.stream ?? false,
      ...options.extraParams
    };
  },

  // Gemini 格式
  gemini: (messages, model, options = {}) => {
    const validMessages = messages.filter(m => m && m.role && m.content !== undefined && m.content !== null);
    const contents = validMessages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(m.content) }]
    }));

    return {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
        ...options.extraParams
      }
    };
  }
};

// ============================================================================
// 响应解析器
// ============================================================================

const ResponseParsers = {
  // OpenAI 格式
  openai: async (response) => {
    const data = await response.json();

    if (data.error) {
      throw new AIError(data.error.message, data.error.code, data.error.type);
    }

    // 检查 choices 是否存在
    if (!data.choices || data.choices.length === 0) {
      return {
        content: '',
        usage: data.usage,
        model: data.model,
        finishReason: 'stop',
        raw: data
      };
    }

    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage,
      model: data.model,
      finishReason: data.choices[0]?.finish_reason,
      raw: data
    };
  },

  // Claude 格式
  claude: async (response) => {
    const data = await response.json();

    if (data.error) {
      throw new AIError(data.error.message, data.error.type);
    }

    // 检查 content 是否存在
    if (!data.content || data.content.length === 0) {
      return {
        content: '',
        usage: data.usage,
        model: data.model,
        finishReason: data.stop_reason || 'stop',
        raw: data
      };
    }

    return {
      content: data.content[0]?.text || '',
      usage: data.usage,
      model: data.model,
      finishReason: data.stop_reason,
      raw: data
    };
  },

  // Gemini 格式
  gemini: async (response) => {
    const data = await response.json();

    if (data.error) {
      throw new AIError(data.error.message, data.error.code);
    }

    // 检查 candidates 是否存在
    if (!data.candidates || data.candidates.length === 0) {
      return {
        content: '',
        usage: data.usageMetadata,
        model: data.modelVersion,
        finishReason: 'stop',
        raw: data
      };
    }

    const candidate = data.candidates[0];

    return {
      content: candidate?.content?.parts?.[0]?.text || '',
      usage: data.usageMetadata,
      model: data.modelVersion,
      finishReason: candidate?.finishReason,
      raw: data
    };
  }
};

// ============================================================================
// 流式响应处理器
// ============================================================================

const StreamHandlers = {
  // OpenAI SSE 格式
  openai: async (response, onChunk) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              onChunk(content, parsed);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  },

  // Claude SSE 格式
  claude: async (response, onChunk) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta') {
              const content = parsed.delta?.text || '';
              if (content) {
                onChunk(content, parsed);
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  },

  // Gemini 流式格式 - 使用 server-sent events
  gemini: async (response, onChunk) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (content) {
              onChunk(content, parsed);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  }
};

// ============================================================================
// 错误类
// ============================================================================

class AIError extends Error {
  constructor(message, code = null, type = null) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.type = type;
  }
}

// ============================================================================
// AI 适配器类
// ============================================================================

class AIAdapter {
  constructor(config = {}) {
    this.configs = { ...DEFAULT_CONFIG };
    this.activeProvider = 'openai';

    // 合并自定义配置
    if (config.providers) {
      Object.entries(config.providers).forEach(([key, value]) => {
        this.configs[key] = { ...this.configs[key], ...value };
      });
    }

    if (config.defaultProvider) {
      this.activeProvider = config.defaultProvider;
    }
  }

  /**
   * 设置当前使用的服务商
   * @param {string} provider 服务商名称
   */
  setProvider(provider) {
    if (!this.configs[provider]) {
      throw new AIError(`未知的服务商: ${provider}`);
    }
    this.activeProvider = provider;
  }

  /**
   * 获取当前服务商配置
   * @returns {object}
   */
  getCurrentConfig() {
    return this.configs[this.activeProvider];
  }

  /**
   * 更新服务商配置
   * @param {string} provider 服务商名称
   * @param {object} config 配置对象
   */
  updateConfig(provider, config) {
    if (!this.configs[provider]) {
      this.configs[provider] = { ...DEFAULT_CONFIG.custom };
    }
    this.configs[provider] = { ...this.configs[provider], ...config };
  }

  /**
   * 添加自定义服务商
   * @param {string} name 服务商标识
   * @param {object} config 配置
   */
  addProvider(name, config) {
    this.configs[name] = {
      ...DEFAULT_CONFIG.custom,
      ...config
    };
  }

  /**
   * 获取所有可用服务商
   * @returns {object[]}
   */
  getProviders() {
    return Object.entries(this.configs).map(([key, config]) => ({
      id: key,
      name: config.name,
      models: config.models,
      defaultModel: config.defaultModel
    }));
  }

  /**
   * 构建请求 URL
   * @param {object} config 配置
   * @param {string} model 模型名称
   * @returns {string}
   */
  buildURL(config, model) {
    const format = config.requestFormat;

    switch (format) {
      case 'gemini':
        return `${config.baseURL}/models/${model}:generateContent?key=${config.apiKey}`;
      case 'openai':
      default:
        // Azure OpenAI 的 URL 已包含 deployment，不需要再添加 /chat/completions
        if (config.baseURL.includes('azure.com') || config.baseURL.includes('deployments')) {
          return `${config.baseURL}/chat/completions?api-version=2024-02-01`;
        }
        return `${config.baseURL}/chat/completions`;
    }
  }

  /**
   * 构建请求头
   * @param {object} config 配置
   * @returns {object}
   */
  buildHeaders(config) {
    const headers = {
      'Content-Type': 'application/json',
      ...config.headers
    };

    // Gemini 使用 URL 参数传递 key
    if (config.requestFormat !== 'gemini' && config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    // Claude 使用 x-api-key
    if (config.requestFormat === 'claude') {
      headers['x-api-key'] = config.apiKey;
    }

    return headers;
  }

  /**
   * 发送聊天请求
   * @param {Array} messages 消息数组 [{role, content}]
   * @param {object} options 选项
   * @returns {Promise<object>}
   */
  async chat(messages, options = {}) {
    // 检查 messages 是否为数组
    if (!Array.isArray(messages)) {
      throw new AIError('messages 必须是数组');
    }

    // 检查 messages 是否为空
    if (messages.length === 0) {
      throw new AIError('messages 不能为空');
    }

    const config = this.getCurrentConfig();
    const model = options.model || config.defaultModel;

    if (!config.baseURL) {
      throw new AIError('未配置 API 地址');
    }

    if (!config.apiKey) {
      throw new AIError('未配置 API Key');
    }

    const url = this.buildURL(config, model);
    const headers = this.buildHeaders(config);

    const formatter = RequestFormatters[config.requestFormat] || RequestFormatters.openai;
    const body = formatter(messages, model, options);

    const maxRetries = options.maxRetries ?? 3;
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new AIError(
            errorData.error?.message || `HTTP ${response.status}`,
            response.status
          );
        }

        // 流式处理
        if (options.stream && options.onChunk) {
          const handler = StreamHandlers[config.responseFormat] || StreamHandlers.openai;
          await handler(response, options.onChunk);
          return { stream: true };
        }

        // 普通响应
        const parser = ResponseParsers[config.responseFormat] || ResponseParsers.openai;
        return await parser(response);

      } catch (error) {
        lastError = error;

        // 不重试的错误
        if (error.code === 401 || error.code === 403) {
          throw error;
        }

        // 等待后重试
        if (attempt < maxRetries - 1) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }

    throw lastError;
  }

  /**
   * 流式聊天
   * @param {Array} messages 消息数组
   * @param {function} onChunk 回调函数 (chunk, raw) => void
   * @param {object} options 选项
   */
  async streamChat(messages, onChunk, options = {}) {
    return this.chat(messages, {
      ...options,
      stream: true,
      onChunk
    });
  }

  /**
   * 简单对话（单轮）
   * @param {string} content 用户输入
   * @param {object} options 选项
   * @returns {Promise<string>}
   */
  async simpleChat(content, options = {}) {
    // 检查 content 是否有效
    if (content === undefined || content === null) {
      throw new AIError('content 不能为空');
    }

    const messages = [
      { role: 'system', content: options.systemPrompt || '你是一个 helpful 的助手。' },
      { role: 'user', content: String(content) }
    ];

    const response = await this.chat(messages, options);
    return response.content;
  }

  /**
   * 延迟函数
   * @param {number} ms 毫秒
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// 预设配置模板
// ============================================================================

const ProviderTemplates = {
  // OpenAI 兼容接口（如 OneAPI、NewAPI 等）
  openaiCompatible: {
    name: 'OpenAI 兼容',
    requestFormat: 'openai',
    responseFormat: 'openai',
    headers: {}
  },

  // Ollama 本地模型
  ollama: {
    name: 'Ollama',
    baseURL: 'http://localhost:11434/v1',
    requestFormat: 'openai',
    responseFormat: 'openai',
    defaultModel: 'llama2',
    models: ['llama2', 'mistral', 'codellama', 'qwen']
  },

  // 智谱 AI
  zhipu: {
    name: '智谱 AI',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    requestFormat: 'openai',
    responseFormat: 'openai',
    defaultModel: 'glm-4',
    models: ['glm-4', 'glm-4-plus', 'glm-4-flash']
  },

  // 百度文心
  wenxin: {
    name: '百度文心',
    baseURL: 'https://qianfan.baidubce.com/v2',
    requestFormat: 'openai',
    responseFormat: 'openai',
    defaultModel: 'ernie-4.0-turbo-8k',
    models: ['ernie-4.0-turbo-8k', 'ernie-3.5-128k']
  },

  // 阿里通义
  qwen: {
    name: '阿里通义',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    requestFormat: 'openai',
    responseFormat: 'openai',
    defaultModel: 'qwen-turbo',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo']
  },

  // DeepSeek
  deepseek: {
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    requestFormat: 'openai',
    responseFormat: 'openai',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-coder']
  },

  // SiliconFlow
  siliconflow: {
    name: 'SiliconFlow',
    baseURL: 'https://api.siliconflow.cn/v1',
    requestFormat: 'openai',
    responseFormat: 'openai',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    models: ['Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V2.5']
  }
};

// ============================================================================
// 预设 System Prompt 角色配置
// ============================================================================

const SystemPrompts = {
  /**
   * 混合文本分词者
   * 严格只返回分词列表，不输出任何其他内容
   */
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
示例输出：["今天", "天气", "真好"]`
};

// ============================================================================
// 导出
// ============================================================================

// 创建单例实例
const aiAdapter = new AIAdapter();

export {
  AIAdapter,
  aiAdapter,
  AIError,
  ProviderTemplates,
  DEFAULT_CONFIG,
  SystemPrompts
};

export default aiAdapter;

// 兼容 CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AIAdapter,
    aiAdapter,
    AIError,
    ProviderTemplates,
    DEFAULT_CONFIG,
    SystemPrompts
  };
}
