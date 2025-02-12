import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Agent } from './constructs/agent';
import { KnowledgeBase } from './constructs/knowledge-base';
import { ActionGroup } from './constructs/action-group';
import { PromptManager } from './prompts/prompt-manager';
import { ModelId } from './types/model';

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
    const BASE_HR_AGENT_NAME:string = 'human-resource-agent';
    
    const hrKnowledgeBase = new KnowledgeBase(this, 'HumanResourceKnowledgeBase', {
      env: env,
      region: region,
      dataSources: [
        {
          dataDir:'./data-source/hr/vacation.md',
          name: BASE_HR_AGENT_NAME,
          description: 'Human resource data source',
        }
      ],
      name: BASE_HR_AGENT_NAME,
      description: 'Human resource knowledge base',
      embeddingModelId: 'amazon.titan-embed-text-v2:0'
    });

    const hrActionGroup = new ActionGroup(this, 'HumanResourceActionGroup', {
      openApiSchemaPath: './action-groups/hr/schema/api-schema.yaml',
      lambdaFunctionPath: './action-groups/hr/lambda/',
      actionGroupName: BASE_HR_AGENT_NAME,
      // lambda がほかのリソースにアクセスする場合に記述する
      // lambdaPolicy: new cdk.aws_iam.PolicyStatement({...})
    })

    const hrAgent = new Agent(this, 'HumanResourceAgent', {
      env: env,
      accountId: accountId,
      region: region,
      name: BASE_HR_AGENT_NAME,
      modelId: modelId,
      actionGroups: [
        hrActionGroup,
      ],
      userInput: true,
      codeInterpreter: true,
      description: `Human resource agent sample`,
      prompts: {
        instruction: promptManager.getPrompts(modelId, BASE_HR_AGENT_NAME).instruction,
        PRE_PROCESSING: promptManager.getPrompts(modelId).preProcessing,
        ORCHESTRATION: promptManager.getPrompts(modelId, BASE_HR_AGENT_NAME).orchestration,
        KNOWLEDGE_BASE_RESPONSE_GENERATION: promptManager.getPrompts(modelId).knowledgeBaseResponseGeneration,
        POST_PROCESSING: promptManager.getPrompts(modelId).postProcessing
      },
      knowledgeBases:[
        {
          knowledgeBaseId: hrKnowledgeBase.knowledgeBaseId,
          description: '人事規則が格納されている KnowledgeBase'
        }
      ]
    });

    new cdk.CfnOutput(this, `${hrAgent.agentName}AgentId`, {
      value: JSON.stringify({
        agentName: hrAgent.agentName,
        agentId: hrAgent.agentId,
        agentAliasId: hrAgent.agentAriasId,
        knowledgeBaseId: hrKnowledgeBase.knowledgeBaseId,
        DataSourceId: hrKnowledgeBase.dataSourceIds
      }),
      exportName: (hrAgent.agentName),
    });

    // ----------------- プロダクトサポートの Agent 実装例 -----------------
    const BASE_PS_AGENT_NAME:string = 'product-support-agent';

    const supportKnowledgeBase = new KnowledgeBase(this, 'SupportKnowledgeBase', {
      env: env,
      region: region,
      dataSources: [
        {
          dataDir:'./data-source/product-support/error_code.md',
          name: 'support-data-source-sample',
          description: 'Support data source sample',
        }
      ],
      name: BASE_PS_AGENT_NAME,
      description: 'Support knowledge base sample',
      embeddingModelId: 'amazon.titan-embed-text-v2:0'
    });
    const supportActionGroup = new ActionGroup(this, 'SupportActionGroup', {
      openApiSchemaPath: './action-groups/product-support/schema/api-schema.yaml',
      lambdaFunctionPath: './action-groups/product-support/lambda/',
      actionGroupName: BASE_PS_AGENT_NAME
    })

    const supportAgent = new Agent(this, 'SupportAgent', {
      env: env,
      accountId: accountId,
      region: region,
      name: BASE_PS_AGENT_NAME,
      modelId: modelId,
      actionGroups: [
        supportActionGroup,
      ],
      userInput: true,
      codeInterpreter: true,
      description: `Support agent sample`,
      prompts: {
        instruction: promptManager.getPrompts(modelId, BASE_PS_AGENT_NAME).instruction,
        PRE_PROCESSING: promptManager.getPrompts(modelId).preProcessing,
        ORCHESTRATION: promptManager.getPrompts(modelId).orchestration,
        KNOWLEDGE_BASE_RESPONSE_GENERATION: promptManager.getPrompts(modelId).knowledgeBaseResponseGeneration,
        POST_PROCESSING: promptManager.getPrompts(modelId).postProcessing
      },
      knowledgeBases:[
        {
          knowledgeBaseId: supportKnowledgeBase.knowledgeBaseId,
          description: 'エラーコードとその詳細が格納されている KnowledgeBase'
        }
      ]
    });

    new cdk.CfnOutput(this, `${supportAgent.agentName}AgentId`, {
      value: JSON.stringify({
        agentName: supportAgent.agentName,
        agentId: supportAgent.agentId,
        agentAliasId: supportAgent.agentAriasId,
        knowledgeBaseId: supportKnowledgeBase.knowledgeBaseId,
        DataSourceId: supportKnowledgeBase.dataSourceIds
      }),
      exportName: (supportAgent.agentName),
    });

    // スタック名の出力
    new cdk.CfnOutput(this, 'StackName', {
      value: this.stackName,
    });
  }
}
