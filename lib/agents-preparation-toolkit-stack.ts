import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PromptManager } from './prompts/prompt-manager';
import { ModelId } from './types/model';
import { AgentBuilder } from './constructs/agent-builder';
import { BedrockLogsWatcherConstruct } from './constructs/bedrock-logs-watcher';
import { ENVIRONMENT_CONFIG, AGENT_CONFIG } from '../parameter';


export class AgentPreparationToolkitStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;
    const prefix: string = ENVIRONMENT_CONFIG.prefix;
    const promptManager = new PromptManager();

    const modelId : ModelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0';

    // ----------------- Python Coder Agent の実装例 -----------------
    if (AGENT_CONFIG.pythonCoder.enabled) {
      const PythonCoderName = 'python-coder';
      new AgentBuilder(this, 'PythonCoder', {
        prefix: prefix,
        region: region,
        accountId: accountId,
        modelId: modelId,
        prompts: {
          instruction: promptManager.getPrompts(modelId, PythonCoderName).instruction,
          PRE_PROCESSING: promptManager.getPrompts(modelId).preProcessing,
          ORCHESTRATION: promptManager.getPrompts(modelId).orchestration,
          KNOWLEDGE_BASE_RESPONSE_GENERATION: promptManager.getPrompts(modelId).knowledgeBaseResponseGeneration,
          POST_PROCESSING: promptManager.getPrompts(modelId, PythonCoderName).postProcessing
        },
        agentName: PythonCoderName,
        actionGroupConfig: {
          openApiSchemaPath: './action-groups/python-coder/schema/api-schema.yaml',
          lambdaFunctionPath: './action-groups/python-coder/lambda/',
        },
        agentConfig: {
          description: 'python coder agent sample',
          userInput: true,
          codeInterpreter: false,
        }
      });
    }

    // ----------------- 人事の Agent 実装例 -----------------
    if (AGENT_CONFIG.hrAgent.enabled) {
      const hrAgentName = 'human-resource-agent';
      new AgentBuilder(this, 'HRAgent', {
        prefix: prefix,
        region: region,
        accountId: accountId,
        modelId: modelId,
        prompts: {
          instruction: promptManager.getPrompts(modelId, hrAgentName).instruction,
          PRE_PROCESSING: promptManager.getPrompts(modelId).preProcessing,
          ORCHESTRATION: promptManager.getPrompts(modelId, hrAgentName).orchestration,
          KNOWLEDGE_BASE_RESPONSE_GENERATION: promptManager.getPrompts(modelId).knowledgeBaseResponseGeneration,
          POST_PROCESSING: promptManager.getPrompts(modelId).postProcessing
        },
        agentName: hrAgentName,
        knowledgeBaseConfig: {
          dataSources: [
            {
              dataDir: './data-source/hr/vacation.md',
              name: hrAgentName,
              description: 'Human resource data source',
            }
          ],
          name: hrAgentName,
          description: '人事規則が格納されている KnowledgeBase',
          embeddingModelId: 'amazon.titan-embed-text-v2:0'
        },
        actionGroupConfig: {
          openApiSchemaPath: './action-groups/hr/schema/api-schema.yaml',
          lambdaFunctionPath: './action-groups/hr/lambda/',
        },
        agentConfig: {
          description: 'Human resource agent sample',
          userInput: true,
          codeInterpreter: true,
        }
      });
    }

    // ----------------- プロダクトサポートの Agent 実装例 -----------------
    if (AGENT_CONFIG.productSupportAgent.enabled) {
      const productSupportAgentName = 'product-support-agent';
      new AgentBuilder(this, 'ProductSupportAgent', {
        prefix: prefix,
        region: region,
        accountId: accountId,
        modelId: modelId,
        prompts: {
          instruction: promptManager.getPrompts(modelId, productSupportAgentName).instruction,
          PRE_PROCESSING: promptManager.getPrompts(modelId).preProcessing,
          ORCHESTRATION: promptManager.getPrompts(modelId).orchestration,
          KNOWLEDGE_BASE_RESPONSE_GENERATION: promptManager.getPrompts(modelId).knowledgeBaseResponseGeneration,
          POST_PROCESSING: promptManager.getPrompts(modelId).postProcessing
        },
        agentName: productSupportAgentName,
        knowledgeBaseConfig: {
          dataSources: [
            {
              dataDir: './data-source/product-support/error_code.md',
              name: productSupportAgentName,
              description: 'Support data source sample',
            }
          ],
          name: productSupportAgentName,
          description: 'エラーコードとその詳細が格納されている KnowledgeBase',
          embeddingModelId: 'amazon.titan-embed-text-v2:0'
        },
        actionGroupConfig: {
          openApiSchemaPath: './action-groups/product-support/schema/api-schema.yaml',
          lambdaFunctionPath: './action-groups/product-support/lambda/',
        },
        agentConfig: {
          description: 'Support agent sample',
          userInput: true,
          codeInterpreter: false,
        }
      });
    }

    // ----------------- Bedrock Logs Watcher の 実装例 -----------------
    if (AGENT_CONFIG.bedrockLogWatcher.enabled) {
      const bedrockLogsBucket = AGENT_CONFIG.bedrockLogWatcher.config.bedrockLogsBucket;
      const bedrockLogsPrefix = AGENT_CONFIG.bedrockLogWatcher.config.bedrockLogsPrefix;
      if (bedrockLogsBucket !== '' && bedrockLogsPrefix !== '') {
        const bedrockLogsWatcher = new BedrockLogsWatcherConstruct(this, 'BedrockLogsWatcherInfra', {
          prefix,
          accountId,
          region,
          bedrockLogsBucket,
          bedrockLogsPrefix
        });
        
        const BedrockLogsWatcherName = 'bedrock-logs-watcher';
        new AgentBuilder(this, 'BedrockLogsWatcher', {
          prefix: prefix,
          region: region,
          accountId: accountId,
          modelId: modelId,
          prompts: {
            instruction: promptManager.getPrompts(modelId, BedrockLogsWatcherName).instruction,
            PRE_PROCESSING: promptManager.getPrompts(modelId).preProcessing,
            ORCHESTRATION: promptManager.getPrompts(modelId).orchestration,
            KNOWLEDGE_BASE_RESPONSE_GENERATION: promptManager.getPrompts(modelId).knowledgeBaseResponseGeneration,
            POST_PROCESSING: promptManager.getPrompts(modelId).postProcessing
          },
          agentName: BedrockLogsWatcherName,
          actionGroupConfig: {
            openApiSchemaPath: './action-groups/bedrock-logs-watcher/schema/api-schema.yaml',
            lambdaFunctionPath: './action-groups/bedrock-logs-watcher/lambda/',
            lambdaPolicies: bedrockLogsWatcher.lambdaPolicies,
            lambdaEnvironment: {
              ATHENA_WORKGROUP: bedrockLogsWatcher.workGroup.name,
              DATABASE: bedrockLogsWatcher.database.ref,
              TABLE: bedrockLogsWatcher.table.ref,
            }
          },
          agentConfig: {
            description: 'bedrock logs watcher',
            userInput: true,
            codeInterpreter: true,
          }
        });
      } else {
        console.error('Bedrock Logs Bucket or Prefix is not set.');
      }
    }

    // スタック名の出力
    new cdk.CfnOutput(this, 'StackName', {
      value: this.stackName,
    });
  }
}