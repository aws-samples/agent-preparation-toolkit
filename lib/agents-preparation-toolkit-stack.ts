import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Agent } from './constructs/agent';
import { KnowledgeBase } from './constructs/knowledge-base';
import { ActionGroup } from './constructs/action-group';
import { Prompts } from './prompts/prompts';
import { ModelId } from './types/agent';

export class AgentPreparationToolkitStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;
    const env: string = ((props && props.env) ?? '') as string;
    
    const modelId: ModelId = 'anthropic.claude-3-haiku-20240307-v1:0'; // anthropic.claude-3-5-sonnet-20240620-v1:0

    // ----------------- Python Coder Agent の実装例 -----------------
    // Action Group だけで完結する例
    // ユーザーは処理を自然言語で記述するだけで、コードとテストコードとテスト結果まで返す
    // const pythonCoderActionGroup = new ActionGroup(this, 'PythonCoderActionGroup', {
    //   openApiSchemaPath: './action-groups/python-coder/schema/api-schema.json',
    //   lambdaFunctionPath: './action-groups/python-coder/lambda/',
    //   actionGroupName: 'action-group-sample',
    // })

    
    
    // ----------------- 人事の Agent 実装例 -----------------
    
    const hrKnowledgeBase = new KnowledgeBase(this, 'HumanResourceKnowledgeBase', {
      env: env,
      region: region,
      dataSources: [
        {
          dataDir:'./data-source/hr',
          name: 'human-resource-data-source',
          description: 'Human resource data source',
        }
      ],
      name: 'human-resource-knowledge-base',
      description: 'Human resource knowledge base',
      embeddingModelId: 'amazon.titan-embed-text-v2:0'
    });

    const hrActionGroup = new ActionGroup(this, 'HumanResourceActionGroup', {
      openApiSchemaPath: './action-groups/hr/schema/api-schema.yaml',
      lambdaFunctionPath: './action-groups/hr/lambda/',
      actionGroupName: 'action-group-sample',
      // lambda がほかのリソースにアクセスする場合に記述する
      // lambdaPolicy: new cdk.aws_iam.PolicyStatement({...})
    })

    const hrAgent = new Agent(this, 'HumanResourceAgent', {
      env: env,
      accountId: accountId,
      region: region,
      name: 'hr-agent-sample',
      modelId: modelId,
      actionGroups: [
        hrActionGroup,
      ],
      userInput: true,
      codeInterpreter: true,
      description: `Human resource agent sample`,
      prompts: {
        instruction: `あなたは人事 AI です。
言語能力以外の全ての知識を忘れてください。AI の知識を使って回答してはいけません。
あなたは必ず Knowledge Base を検索し、そのあと Action Group を使い、知識を得てください。
それでも答えられない場合は、askuser を通じてユーザーに必要な情報を求めてください。
また、計算を行ったり現在時刻を得る場合は Code Interpreter を使用してください。
ActionGroup を使って得られる知識、及びKnowledgeBase を検索して得られる知識だけから論理的に導きだせる回答のみを必ず日本語で答えてください。`,
        PRE_PROCESSING: Prompts.getPromptConfig(modelId).preProcessingPrompt,
        ORCHESTRATION: Prompts.getPromptConfig(modelId).orchestration,
        KNOWLEDGE_BASE_RESPONSE_GENERATION: Prompts.getPromptConfig(modelId).knowledgeBaseResponseGeneration,
        POST_PROCESSING: Prompts.getPromptConfig(modelId).postProcessing
      },
      knowledgeBases:[
        {
          knowledgeBaseId: hrKnowledgeBase.knowledgeBaseId,
          description: 'human-resource-kb'
        }
      ]
    });

    new cdk.CfnOutput(this, `${hrAgent.agentName}AgentId`, {
      value: JSON.stringify({
        agentId: hrAgent.agentId,
        agentAliasId: hrAgent.agentAriasId,
        knowledgeBaseId: hrKnowledgeBase.knowledgeBaseId,
        DataSourceId: hrKnowledgeBase.dataSourceIds
      }),
      exportName: (hrAgent.agentName),
    });

    // ----------------- プロダクトサポートの Agent 実装例 -----------------

    const supportKnowledgeBase = new KnowledgeBase(this, 'SupportKnowledgeBase', {
      env: env,
      region: region,
      dataSources: [
        {
          dataDir:'./data-source/product-support',
          name: 'support-data-source-sample',
          description: 'Support data source sample',
        }
      ],
      name: 'support-knowledge-base-sample',
      description: 'Support knowledge base sample',
      embeddingModelId: 'amazon.titan-embed-text-v2:0'
    });
    const supportActionGroup = new ActionGroup(this, 'SupportActionGroup', {
      openApiSchemaPath: './action-groups/product-support/schema/api-schema.yaml',
      lambdaFunctionPath: './action-groups/product-support/lambda/',
      actionGroupName: 'support-action-group-sample'
    })

    const supportAgent = new Agent(this, 'SupportAgent', {
    
      env: env,
      accountId: accountId,
      region: region,
      name: 'support-agent-sample',
      modelId: modelId,
      actionGroups: [
        supportActionGroup,
      ],
      userInput: true,
      codeInterpreter: true,
      description: `Support agent sample`,
      prompts: {
        instruction: `あなたはプリンターの対応マンです。
ユーザーはエラーコードを与えます。KnowledgeBase からエラーコードの詳細を取り、ActionGroup からそのエラーコードのサポート履歴を取得し、ユーザーに何をすべきかを提案してください。
ただし回答は**必ず日本語で**答えてください。`,
        PRE_PROCESSING: Prompts.getPromptConfig(modelId).preProcessingPrompt,
        ORCHESTRATION: Prompts.getPromptConfig(modelId).orchestration,
        KNOWLEDGE_BASE_RESPONSE_GENERATION: Prompts.getPromptConfig(modelId).knowledgeBaseResponseGeneration,
        POST_PROCESSING: Prompts.getPromptConfig(modelId).postProcessing
      },
      knowledgeBases:[
        {
          knowledgeBaseId: supportKnowledgeBase.knowledgeBaseId,
          description: 'support-kb'
        }
      ]
    });

    new cdk.CfnOutput(this, `${supportAgent.agentName}AgentId`, {
      value: JSON.stringify({
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
