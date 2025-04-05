import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KnowledgeBase } from './knowledge-base';
import { ActionGroup } from './action-group';
import { Agent } from './agent';
import { ModelId } from '../types/model';
import { EmbeddingModelId } from '../types/model'
import { OpenApiPath } from '../types';
import * as iam from 'aws-cdk-lib/aws-iam';
import { lambdaEnvironment } from '../types';

export interface DataSourceConfig {
  dataDir: string;
  name: string;
  description: string;
}

export interface AgentBuilderProps {
  prefix: string;
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
  actionGroupConfigs?: {
    openApiSchemaPath: OpenApiPath;
    lambdaFunctionPath: string;
    lambdaPolicies?: iam.PolicyStatement[];
    lambdaEnvironment?: lambdaEnvironment;
  }[];
  agentConfig: {
    description: string;
    userInput: boolean;
    codeInterpreter: boolean;
  };
}

export class AgentBuilder extends Construct {
  public readonly agent: Agent;
  public readonly knowledgeBase: KnowledgeBase;
  public readonly actionGroups: ActionGroup[] = [];

  constructor(scope: Construct, id: string, props: AgentBuilderProps) {
    super(scope, id);

    // Knowledge Base の作成
    if (props.knowledgeBaseConfig){
      this.knowledgeBase = new KnowledgeBase(this, 'KnowledgeBase', {
        prefix: props.prefix,
        region: props.region,
        dataSources: props.knowledgeBaseConfig.dataSources,
        name: props.knowledgeBaseConfig.name,
        description: props.knowledgeBaseConfig.description,
        embeddingModelId: props.knowledgeBaseConfig.embeddingModelId
      });
    }

    // Action Groups の作成
    if (props.actionGroupConfigs && props.actionGroupConfigs.length > 0){
      props.actionGroupConfigs.forEach((config, index) => {
        const actionGroup = new ActionGroup(this, `ActionGroup-${index}`, {
          openApiSchemaPath: config.openApiSchemaPath,
          lambdaFunctionPath: config.lambdaFunctionPath,
          actionGroupName: `${props.agentName}-${index}`,
          lambdaPolicies: config.lambdaPolicies,
          lambdaEnvironment: config.lambdaEnvironment
        });
        this.actionGroups.push(actionGroup);
      });
    }

    // Agent の作成
    this.agent = new Agent(this, 'Agent', {
      prefix: props.prefix,
      accountId: props.accountId,
      region: props.region,
      name: props.agentName,
      modelId: props.modelId,
      ...(this.actionGroups.length > 0 && {
        actionGroups: this.actionGroups
      }),
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
    
    // ActionGroup への依存関係を追加
    if(this.actionGroups.length > 0){
      this.actionGroups.forEach(actionGroup => {
        this.agent.node.addDependency(actionGroup.bucketDeployment);
      });
    }

    // 出力の作成
    new cdk.CfnOutput(this, `${this.agent.agentName}AgentId`, {
      value: JSON.stringify({
        agentName: this.agent.agentName,
        agentId: this.agent.agentId,
        agentAliasId: this.agent.agentAriasId,
        ...(this.knowledgeBase && {
          knowledgeBaseId: this.knowledgeBase.knowledgeBaseId,
          DataSourceId: this.knowledgeBase.dataSourceIds,
        }),
      }),
      exportName: (this.agent.agentName),
    });
  }
}