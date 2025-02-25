import { z } from 'zod';

// 環境設定
export const EnvironmentSchema = z.object({
  env: z.string(),
});

export type EnvironmentConfig = z.infer<typeof EnvironmentSchema>;

export const ENVIRONMENT_CONFIG: EnvironmentConfig = {
  env: 'dev-',
};


export const BedrockLogsSchema = z.object({
  bedrockLogsBucket: z.string(),
  bedrockLogsPrefix: z.string(),
});

export type BedrockLogsConfig = z.infer<typeof BedrockLogsSchema>;

export const BEDROCK_LOGS_CONFIG: BedrockLogsConfig = {
  bedrockLogsBucket: "", // Bedrock のログを保存しているバケット。設定していない場合はマネジメントコンソールから設定すること
  bedrockLogsPrefix: "", //デフォルトだとこちら → /AWSLogs/{ACCOUNT}/BedrockModelInvocationLogs/{REGION}/
};