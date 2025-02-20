import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Agent } from './constructs/agent';
import { KnowledgeBase } from './constructs/knowledge-base';
import { ActionGroup } from './constructs/action-group';
import { PromptManager } from './prompts/prompt-manager';
import { ModelId } from './types/model';
import { AgentBuilder } from './constructs/agent-builder';

export class AgentPreparationToolkitStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;
    const env: string = ((props && props.env) ?? '') as string;
    const promptManager = new PromptManager();

    // const modelId: ModelId = 'anthropic.claude-3-5-haiku-20241022-v1:0';
    // const modelId: ModelId = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
    const modelId : ModelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0';

    // ----------------- Python Coder Agent の実装例 -----------------
    // Action Group だけで完結する例
    // ユーザーは処理を自然言語で記述するだけで、コードとテストコードとテスト結果まで返す
    const BASE_AGENT_NAME:string = 'python-coder';

    const pythonCoderActionGroup = new ActionGroup(this, 'PythonCoderActionGroup', {
      openApiSchemaPath: './action-groups/python-coder/schema/api-schema.yaml',
      lambdaFunctionPath: './action-groups/python-coder/lambda/',
      actionGroupName: `${env}${BASE_AGENT_NAME}`,
    })

    const pythonCoderAgent:Agent = new Agent(this, 'PythonCoderAgent', {
      env: env,
      accountId: accountId,
      region: region,
      name: BASE_AGENT_NAME,
      modelId: modelId,
      actionGroups: [
        pythonCoderActionGroup,
      ],
      userInput: true,
      codeInterpreter: true,
      description: `python coder agent`,
      prompts: {
        instruction: promptManager.getPrompts(modelId, BASE_AGENT_NAME).instruction,
        PRE_PROCESSING: promptManager.getPrompts(modelId).preProcessing,
        ORCHESTRATION: promptManager.getPrompts(modelId).orchestration,
        KNOWLEDGE_BASE_RESPONSE_GENERATION: promptManager.getPrompts(modelId).knowledgeBaseResponseGeneration,
        POST_PROCESSING: promptManager.getPrompts(modelId, BASE_AGENT_NAME).postProcessing
      },
    });

    pythonCoderAgent.node.addDependency(pythonCoderActionGroup.bucketDeployment);

    new cdk.CfnOutput(this, `${pythonCoderAgent.agentName}AgentId`, {
      value: JSON.stringify({
        agentName: pythonCoderAgent.agentName,
        agentId: pythonCoderAgent.agentId,
        agentAliasId: pythonCoderAgent.agentAriasId,
      }),
      exportName: (pythonCoderAgent.agentName),
    });


    // ----------------- 人事の Agent 実装例 -----------------
    const hrAgentName:string = 'human-resource-agent';
    const hrAgent = new AgentBuilder(this, 'HRAgent', {
      env: env,
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
        description: 'Human resource knowledge base',
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
        knowledgeBaseDescription: '人事規則が格納されている KnowledgeBase'
      }
    });

    // ----------------- プロダクトサポートの Agent 実装例 -----------------
    const productSupportAgentName:string = 'product-support-agent';
    const productSupportAgent = new AgentBuilder(this, 'ProductSupportAgent', {
      env: env,
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
        description: 'Support knowledge base sample',
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
        knowledgeBaseDescription: 'エラーコードとその詳細が格納されている KnowledgeBase'
      }
    });

    // スタック名の出力
    new cdk.CfnOutput(this, 'StackName', {
      value: this.stackName,
    });
  }
}
