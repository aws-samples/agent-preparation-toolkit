// constructs/agent-builder.ts

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KnowledgeBase } from './knowledge-base';
import { ActionGroup } from './action-group';
import { Agent } from './agent';
import { PromptManager } from '../prompts/prompt-manager';
import { ModelId } from '../types/model';
import { EmbeddingModelId } from '../types/model'
import { OpenApiPath } from '../types';

export interface DataSourceConfig {
  dataDir: string;
  name: string;
  description: string;
}

export interface AgentBuilderProps {
  env: string;
  region: string;
  accountId: string;
  modelId: ModelId;
  promptManager: PromptManager;
  agentName: string;
  knowledgeBaseConfig: {
    dataSources: DataSourceConfig[];
    name: string;
    description: string;
    embeddingModelId: EmbeddingModelId;
  };
  actionGroupConfig: {
    openApiSchemaPath: OpenApiPath;
    lambdaFunctionPath: string;
  };
  agentConfig: {
    description: string;
    userInput: boolean;
    codeInterpreter: boolean;
    knowledgeBaseDescription: string;
  };
}

export class AgentBuilder extends Construct {
  public readonly agent: Agent;
  public readonly knowledgeBase: KnowledgeBase;
  public readonly actionGroup: ActionGroup;

  constructor(scope: Construct, id: string, props: AgentBuilderProps) {
    super(scope, id);

    // Knowledge Base の作成
    this.knowledgeBase = new KnowledgeBase(this, 'KnowledgeBase', {
      env: props.env,
      region: props.region,
      dataSources: props.knowledgeBaseConfig.dataSources,
      name: props.knowledgeBaseConfig.name,
      description: props.knowledgeBaseConfig.description,
      embeddingModelId: props.knowledgeBaseConfig.embeddingModelId
    });

    // Action Group の作成
    this.actionGroup = new ActionGroup(this, 'ActionGroup', {
      openApiSchemaPath: props.actionGroupConfig.openApiSchemaPath,
      lambdaFunctionPath: props.actionGroupConfig.lambdaFunctionPath,
      actionGroupName: props.agentName,
    });

    // Agent の作成
    this.agent = new Agent(this, 'Agent', {
      env: props.env,
      accountId: props.accountId,
      region: props.region,
      name: props.agentName,
      modelId: props.modelId,
      actionGroups: [
        this.actionGroup,
      ],
      userInput: props.agentConfig.userInput,
      codeInterpreter: props.agentConfig.codeInterpreter,
      description: props.agentConfig.description,
      prompts: {
        instruction: props.promptManager.getPrompts(props.modelId, props.agentName).instruction,
        PRE_PROCESSING: props.promptManager.getPrompts(props.modelId).preProcessing,
        ORCHESTRATION: props.promptManager.getPrompts(props.modelId, props.agentName).orchestration,
        KNOWLEDGE_BASE_RESPONSE_GENERATION: props.promptManager.getPrompts(props.modelId).knowledgeBaseResponseGeneration,
        POST_PROCESSING: props.promptManager.getPrompts(props.modelId).postProcessing
      },
      knowledgeBases: [
        {
          knowledgeBaseId: this.knowledgeBase.knowledgeBaseId,
          description: props.agentConfig.knowledgeBaseDescription
        }
      ]
    });

    // 出力の作成
    new cdk.CfnOutput(this, `${this.agent.agentName}AgentId`, {
      value: JSON.stringify({
        agentName: this.agent.agentName,
        agentId: this.agent.agentId,
        agentAliasId: this.agent.agentAriasId,
        knowledgeBaseId: this.knowledgeBase.knowledgeBaseId,
        DataSourceId: this.knowledgeBase.dataSourceIds
      }),
      exportName: (this.agent.agentName),
    });
  }
}