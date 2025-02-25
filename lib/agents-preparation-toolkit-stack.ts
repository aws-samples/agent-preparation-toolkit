import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PromptManager } from './prompts/prompt-manager';
import { ModelId } from './types/model';
import { AgentBuilder } from './constructs/agent-builder';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as athena from 'aws-cdk-lib/aws-athena';
import * as iam from 'aws-cdk-lib/aws-iam';
import { BEDROCK_LOGS_CONFIG } from '../parameter';

export class AgentPreparationToolkitStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;
    const env: string = ((props && props.env) ?? '') as string;
    const promptManager = new PromptManager();

    // const modelId: ModelId = 'anthropic.claude-3-5-haiku-20241022-v1:0';
    const modelId : ModelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0';

    // ----------------- Python Coder Agent の実装例 -----------------
    // Action Group だけで完結する例
    // ユーザーは処理を自然言語で記述するだけで、コードとテストコードとテスト結果まで返す

    const PythonCoderName = 'python-coder';
    new AgentBuilder(this, 'PythonCoder', {
      env: env,
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

    // ----------------- 人事の Agent 実装例 -----------------
    const hrAgentName = 'human-resource-agent';
    new AgentBuilder(this, 'HRAgent', {
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

    // ----------------- プロダクトサポートの Agent 実装例 -----------------
    const productSupportAgentName = 'product-support-agent';
    new AgentBuilder(this, 'ProductSupportAgent', {
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

    // ----------------- Bedrock Logs Watcher の 実装例 -----------------

    const bedrockLogsBucket = BEDROCK_LOGS_CONFIG.bedrockLogsBucket;
    const bedrockLogsPrefix = BEDROCK_LOGS_CONFIG.bedrockLogsPrefix;
    const bedrockLogsS3Uri = `s3://${bedrockLogsBucket}${bedrockLogsPrefix}`
    const bedrockLogsBucketArn = `arn:aws:s3:::${bedrockLogsBucket}`
    if (bedrockLogsBucket !== '' && bedrockLogsPrefix !== '') {
      const queryResultsBucket = new s3.Bucket(this, 'AthenaQueryResultsBucket', {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        serverAccessLogsPrefix: 'AccessLogs/',
        lifecycleRules: [
          {
            expiration: cdk.Duration.days(7),
            prefix: 'query-results/'
          }
        ]
      });

      const workGroup = new athena.CfnWorkGroup(this, 'BedrockLogsWorkgroup', {
        name: 'bedrock-logs-workgroup',
        description: 'Workgroup for querying Bedrock logs',
        state: 'ENABLED',
        workGroupConfiguration: {
          resultConfiguration: {
            outputLocation: `s3://${queryResultsBucket.bucketName}/query-results/`,
            encryptionConfiguration: {
              encryptionOption: 'SSE_S3'
            }
          },
          enforceWorkGroupConfiguration: true,
          publishCloudWatchMetricsEnabled: true,
          engineVersion: {
            selectedEngineVersion: 'Athena engine version 3'
          }
        },
      });

      const database = new glue.CfnDatabase(this, 'BedrockLogsDatabase', {
        catalogId: accountId,
        databaseInput: {
          name: 'bedrock_logs_db',
        },
      });

      // Glue Table の作成
      new glue.CfnTable(this, 'BedrockLogsTable', {
        catalogId: accountId,
        databaseName: database.ref,
        tableInput: {
          name: 'bedrock_model_invocation_logs',
          tableType: 'EXTERNAL_TABLE',
          parameters: {
            'classification': 'json'
          },
          storageDescriptor: {
            location: bedrockLogsS3Uri,
            inputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
            outputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
            compressed: false,
            numberOfBuckets: 0,
            serdeInfo: {
              serializationLibrary: 'org.openx.data.jsonserde.JsonSerDe',
              parameters: {
                'ignore.malformed.json' : 'true'
              }
            },
            sortColumns:[],
            storedAsSubDirectories: false,
            columns: [
              { name: 'schematype', type: 'string', comment: '' },
              { name: 'schemaversion', type: 'string', comment: '' },
              { name: 'timestamp', type: 'timestamp', comment: '' },
              { name: 'accountid', type: 'string', comment: '' },
              { name: 'identity', type: 'struct<arn:string>', comment: 'IAM ユーザーもしくはロールの ARN が格納' },
              { name: 'region', type: 'string', comment: 'API を呼び出したリージョン' },
              { name: 'requestid', type: 'string', comment: '' },
              { name: 'operation', type: 'string', comment: '' },
              { name: 'modelid', type: 'string', comment: '使用したモデルの ID' },
              { name: 'input', type: 'struct<inputcontenttype:string,inputTokenCount:int,inputbodyjson:string>', comment: 'inputcontenttype はモデルに入力したデータの形式、inputTokenCount はモデルに入力したトークン数、inputbodyjson はモデルに入力したデータで文字列型であり、JSON Parse できるかの保証がないので注意' },
              { name: 'output', type: 'struct<outputcontenttype:string,outputTokenCount:int,outputbodyjson:string>', comment: 'outputcontenttype はモデルが出力したデータの形式、outputTokenCount はモデルが出力したトークン数、outputbodyjson はモデルが出力したデータで文字列型であり、JSON Parse できるかの保証がないので注意' },
              { name: 'inferenceregion', type: 'string', comment: 'モデルが推論したリージョン' }
            ],
          },
          retention:0,
          partitionKeys: [],
        },
      });
      
      const BedrockLogsWatcherName = 'bedrock-logs-watcher';
      new AgentBuilder(this, 'BedrockLogsWatcher', {
        env: env,
        region: region,
        accountId: accountId,
        modelId: modelId,
        prompts: {
          instruction: promptManager.getPrompts(modelId, BedrockLogsWatcherName).instruction,
          PRE_PROCESSING: promptManager.getPrompts(modelId).preProcessing,
          ORCHESTRATION: promptManager.getPrompts(modelId).orchestration,
          KNOWLEDGE_BASE_RESPONSE_GENERATION: promptManager.getPrompts(modelId).knowledgeBaseResponseGeneration,
          POST_PROCESSING: promptManager.getPrompts(modelId, PythonCoderName).postProcessing
        },
        agentName: BedrockLogsWatcherName,
        actionGroupConfig: {
          openApiSchemaPath: './action-groups/bedrock-logs-watcher/schema/api-schema.yaml',
          lambdaFunctionPath: './action-groups/bedrock-logs-watcher/lambda/',
          lambdaPolicies: [
            new iam.PolicyStatement({
              actions: [
                's3:GetBucketLocation',
                's3:GetObject',
                "s3:PutObject",
                "s3:DeleteObject",
                's3:ListBucket',
              ],
              resources: [
                queryResultsBucket.bucketArn,
                `${queryResultsBucket.bucketArn}/*`,
              ]
            }),
            new iam.PolicyStatement({
              actions: [
                'glue:GetTable',
                'glue:BatchGetTable',
                'glue:GetDatabase',
                'athena:GetQueryExecution',
                'athena:StartQueryExecution',
                'athena:GetQueryResults',
                'kms:Decrypt',
              ],
              resources: [
                `arn:aws:glue:${region}:${accountId}:catalog`,
                `arn:aws:glue:${region}:${accountId}:database/bedrock_logs_db`,
                `arn:aws:glue:${region}:${accountId}:table/bedrock_logs_db/*`,
                `arn:aws:athena:${region}:${accountId}:workgroup/${workGroup.name}`,
                `arn:aws:kms:${region}:${accountId}:key/*`,
              ]
            }),
            new iam.PolicyStatement({
              actions: [
                's3:GetObject',
                's3:ListBucket',
              ],
              resources: [
                `${bedrockLogsBucketArn}/*`,
                bedrockLogsBucketArn,
              ]
            }),
          ]
        },
        agentConfig: {
          description: 'bedrock logs watcher',
          userInput: true,
          codeInterpreter: true,
        }
      });
    }

    // スタック名の出力
    new cdk.CfnOutput(this, 'StackName', {
      value: this.stackName,
    });
  }
}
