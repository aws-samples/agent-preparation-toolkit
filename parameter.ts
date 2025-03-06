import { z } from 'zod';

// 環境設定
export const EnvironmentSchema = z.object({
  prefix: z.string(),
});

export type EnvironmentConfig = z.infer<typeof EnvironmentSchema>;

export const ENVIRONMENT_CONFIG: EnvironmentConfig = {
  prefix: 'dev-',
};

export const BedrockLogsSchema = z.object({
  bedrockLogsBucket: z.string(),
  bedrockLogsPrefix: z.string(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const AgentConfigSchema = z.object({
  pythonCoder: z.object({
    enabled: z.boolean()
  }),
  hrAgent: z.object({
    enabled: z.boolean(),
  }),
  productSupportAgent: z.object({
    enabled: z.boolean(),
  }),
  contractSearcher: z.object({
    enabled: z.boolean(),
  }),
  bedrockLogWatcher: z.object({
    enabled: z.boolean(),
    config: BedrockLogsSchema.required()
  }),
});

export const AGENT_CONFIG: AgentConfig = {
  pythonCoder: {
    enabled: true,
  },
  hrAgent: {
    enabled: false,
  },
  productSupportAgent: {
    enabled: false,
  },
  contractSearcher: {
    enabled: false,
  },
  bedrockLogWatcher: {
    enabled: false,
    config: {
      bedrockLogsBucket: '', // Bedrock のログを保存しているバケット。設定していない場合はマネジメントコンソールから設定すること
      bedrockLogsPrefix: '', //デフォルトだとこちら → /AWSLogs/{ACCOUNT}/BedrockModelInvocationLogs/{REGION}/
    },
  }
};