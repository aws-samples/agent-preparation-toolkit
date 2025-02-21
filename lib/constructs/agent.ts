import { Construct } from 'constructs';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import { AgentRole } from './agents-role';
import { ActionGroup } from './action-group';
import { ModelId } from '../types/model'

export interface AgentProps {
  readonly env: string;
  readonly accountId: string;
  readonly region: string;
  readonly name: string;
  readonly modelId: ModelId;
  readonly actionGroups: ActionGroup[];
  readonly userInput: boolean;
  readonly codeInterpreter: boolean;
  readonly description?: string;
  readonly prompts: {
    instruction: string;
    PRE_PROCESSING: string;
    ORCHESTRATION: string;
    KNOWLEDGE_BASE_RESPONSE_GENERATION: string;
    POST_PROCESSING: string;
  };
  readonly knowledgeBases?: [{
    knowledgeBaseId : string,
    description: string | undefined,
  }
  ];
}

export class Agent extends Construct {
  public readonly agentName: string;
  public readonly agentId: string;
  public readonly agentAriasId: string;

  constructor(scope: Construct, id: string, props: AgentProps) {
    super(scope, id);

    const agentRole = new AgentRole(this, `AgentRole`, {
      accountId: props.accountId,
      region: props.region,
      agentName: `${props.env}${props.name}`,
      knowledgeBaseIds: props.knowledgeBases ? props.knowledgeBases.map(KnowledgeBase => KnowledgeBase.knowledgeBaseId): [],
      roleName: props.name,
      lambdaFunctions: props.actionGroups.map(actionGroup => actionGroup.lambdaFunction),
      s3Buckets: props.actionGroups.map(actionGroup => actionGroup.bucket)
    });

    const agent = new bedrock.CfnAgent(this, `${props.env}Agent`, {
      agentName: `${props.env}${props.name}`,
      agentResourceRoleArn: agentRole.roleArn,
      instruction: props.prompts.instruction,
      knowledgeBases: props.knowledgeBases ? props.knowledgeBases.map(knowledgeBase => ({
        knowledgeBaseId: knowledgeBase.knowledgeBaseId,
        description: knowledgeBase.description || '',
      })) : [],
      foundationModel: props.modelId,
      idleSessionTtlInSeconds:600,
      actionGroups: [
        ...props.actionGroups.map(actionGroup => ({
          actionGroupName: actionGroup.actionGroupName,
          actionGroupExecutor: {
            lambda: actionGroup.lambdaFunction.functionArn
          },
          apiSchema: {
            s3: {
              s3BucketName: actionGroup.apiSchemaBucketName,
              s3ObjectKey: actionGroup.apiSchemaObjectKey,
            },
          },
        })),
        ...(props.userInput ? [{
          actionGroupName: 'UserInput',
          parentActionGroupSignature: 'AMAZON.UserInput',
        }] : []),
        ...(props.codeInterpreter ? [{
          actionGroupName: 'CodeInterpreter',
          parentActionGroupSignature: 'AMAZON.CodeInterpreter',
        }] : [])
      ],
      autoPrepare: true,
      description: props.description || '',
      promptOverrideConfiguration:{
        promptConfigurations: [
          {
            basePromptTemplate: props.prompts.PRE_PROCESSING,
            inferenceConfiguration: {
              maximumLength: 2048,
              stopSequences: ['\n\nHuman:'],
              temperature: 0.0,
              topK: 250,
              topP: 1.0
            },
            parserMode: 'DEFAULT',
            promptCreationMode: 'OVERRIDDEN',
            promptState: 'ENABLED',
            promptType: 'PRE_PROCESSING'
          },
          {
            basePromptTemplate: props.prompts.ORCHESTRATION,
            inferenceConfiguration: {
              maximumLength: 2048,
              stopSequences: ['</invoke>', '</answer>', '</error>'],
              temperature: 0.0,
              topK: 250,
              topP: 1.0
            },
            parserMode: 'DEFAULT',
            promptCreationMode: 'OVERRIDDEN',
            promptState: 'ENABLED',
            promptType: 'ORCHESTRATION'
          },
          {
            basePromptTemplate: props.prompts.KNOWLEDGE_BASE_RESPONSE_GENERATION,
            inferenceConfiguration: {
              maximumLength: 2048,
              stopSequences: ['\n\nHuman:'],
              temperature: 0.0,
              topK: 250,
              topP: 1.0
            },
            parserMode: 'DEFAULT',
            promptCreationMode: 'OVERRIDDEN',
            promptState: 'ENABLED',
            promptType: 'KNOWLEDGE_BASE_RESPONSE_GENERATION'
          },
          {
            basePromptTemplate: props.prompts.POST_PROCESSING,
            inferenceConfiguration: {
              maximumLength: 2048,
              stopSequences: ['\n\nHuman:'],
              temperature: 0.0,
              topK: 250,
              topP: 1.0
            },
            parserMode: 'DEFAULT',
            promptCreationMode: 'OVERRIDDEN',
            promptState: 'ENABLED',
            promptType: 'POST_PROCESSING'
          },
          // MEMORY_SUMMARIZATION Prompt (CDK が未対応)
//           {
//             basePromptTemplate: props.prompts.MEMORY_SUMMARIZATION,
//             inferenceConfiguration: {
//               maximumLength: 2048,
//               stopSequences: ['\n\nHuman:'],
//               temperature: 0.0,
//               topK: 250,
//               topP: 1.0
//             },
//             parserMode: 'DEFAULT',
//             promptCreationMode: 'DEFAULT',
//             promptState: 'ENABLED',
//             promptType: 'MEMORY_SUMMARIZATION'
//           },
        ]
      }
    });
    agent.node.addDependency(agentRole);

    for (const actionGroup of props.actionGroups){
      actionGroup.lambdaFunction.addPermission('bedrock-agents',{
        principal: new iam.ServicePrincipal('bedrock.amazonaws.com'),
        action: 'lambda:InvokeFunction',
        sourceArn: agent.attrAgentArn
      })
    }

    
    const agentAlias = new bedrock.CfnAgentAlias(this, `${props.env}AgentAlias`, {
      agentAliasName: 'v1',
      agentId: agent.attrAgentId,
    });

    this.agentName = agent.agentName
    this.agentId = agent.attrAgentId;
    this.agentAriasId = agentAlias.attrAgentAliasId
  }
}