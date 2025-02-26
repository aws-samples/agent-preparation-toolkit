import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as athena from 'aws-cdk-lib/aws-athena';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface BedrockLogsWatcherProps {
  env: string;
  accountId: string;
  region: string;
  bedrockLogsBucket: string;
  bedrockLogsPrefix: string;
}

export class BedrockLogsWatcherConstruct extends Construct {
  public readonly queryResultsBucket: s3.Bucket;
  public readonly workGroup: athena.CfnWorkGroup;
  public readonly database: glue.CfnDatabase;
  public readonly table: glue.CfnTable;
  public readonly lambdaPolicies: iam.PolicyStatement[];

  constructor(scope: Construct, id: string, props: BedrockLogsWatcherProps) {
    super(scope, id);

    const { accountId, region, bedrockLogsBucket, bedrockLogsPrefix } = props;
    const bedrockLogsS3Uri = `s3://${bedrockLogsBucket}${bedrockLogsPrefix}`;
    const bedrockLogsBucketArn = `arn:aws:s3:::${bedrockLogsBucket}`;

    // Athena クエリ結果を保存する S3 バケットの作成
    this.queryResultsBucket = new s3.Bucket(this, 'AthenaQueryResultsBucket', {
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

    // Athena ワークグループの作成
    this.workGroup = new athena.CfnWorkGroup(this, 'BedrockLogsWorkgroup', {
      name: `${props.env}bedrock-logs-workgroup`,
      recursiveDeleteOption: true,
      description: 'Workgroup for querying Bedrock logs',
      state: 'ENABLED',
      workGroupConfiguration: {
        resultConfiguration: {
          outputLocation: `s3://${this.queryResultsBucket.bucketName}/query-results/`,
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

    // Glue データベースの作成
    this.database = new glue.CfnDatabase(this, 'BedrockLogsDatabase', {
      catalogId: accountId,
      databaseInput: {
        name: `${props.env}bedrock_logs_db`,
      },
    });

    // Glue テーブルの作成
    this.table = new glue.CfnTable(this, 'BedrockLogsTable', {
      catalogId: accountId,
      databaseName: this.database.ref,
      tableInput: {
        name: `${props.env}bedrock_model_invocation_logs`,
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
        retention: 0,
        partitionKeys: [],
      },
    });

    // Lambda 関数に付与するポリシーステートメントの作成
    this.lambdaPolicies = [
      new iam.PolicyStatement({
        actions: [
          's3:GetBucketLocation',
          's3:GetObject',
          "s3:PutObject",
          "s3:DeleteObject",
          's3:ListBucket',
        ],
        resources: [
          this.queryResultsBucket.bucketArn,
          `${this.queryResultsBucket.bucketArn}/*`,
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
          `arn:aws:glue:${region}:${accountId}:database/${this.database.ref}`,
          `arn:aws:glue:${region}:${accountId}:table/${this.database.ref}/*`,
          `arn:aws:athena:${region}:${accountId}:workgroup/${this.workGroup.name}`,
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
    ];
  }
}