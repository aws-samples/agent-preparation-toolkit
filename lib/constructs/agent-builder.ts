// constructs/agent-builder.ts

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KnowledgeBase } from './knowledge-base';
import { ActionGroup } from './action-group';
import { Agent } from './agent';
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
  prompts: {
    instruction: string;
    PRE_PROCESSING: string;
    ORCHESTRATION: string;
    KNOWLEDGE_BASE_RESPONSE_GENERATION: string;
    POST_PROCESSING: string;
  };
  agentName: string;
  knowledgeBaseConfig?: {
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
  };
}

export class AgentBuilder extends Construct {
  public readonly agent: Agent;
  public readonly knowledgeBase: KnowledgeBase;
  public readonly actionGroup: ActionGroup;

  constructor(scope: Construct, id: string, props: AgentBuilderProps) {
    super(scope, id);

    // Knowledge Base の作成
    if (props.knowledgeBaseConfig){
      this.knowledgeBase = new KnowledgeBase(this, 'KnowledgeBase', {
        env: props.env,
        region: props.region,
        dataSources: props.knowledgeBaseConfig.dataSources,
        name: props.knowledgeBaseConfig.name,
        description: props.knowledgeBaseConfig.description,
        embeddingModelId: props.knowledgeBaseConfig.embeddingModelId
      });
    }

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
      prompts: props.prompts,
      ...(props.knowledgeBaseConfig && {
        knowledgeBases: [
          {
            knowledgeBaseId: this.knowledgeBase.knowledgeBaseId,
            description: props.knowledgeBaseConfig.description,
          }
        ]
      })
    });
    this.agent.node.addDependency(this.actionGroup.bucketDeployment);

    // 出力の作成
    new cdk.CfnOutput(this, `${this.agent.agentName}AgentId`, {
      value: JSON.stringify({
        agentName: this.agent.agentName,
        agentId: this.agent.agentId,
        agentAliasId: this.agent.agentAriasId,
      }),
      exportName: (this.agent.agentName),
    });
  }
}