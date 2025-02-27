import { Construct } from 'constructs';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { KnowledgeBaseRole } from './knowledge-base-role';
import { KnowledgeBaseCollection } from './knowledge-base-collection';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { BucketDeployment } from './bucket-deployment';
import { EmbeddingModelId } from '../types';

interface DataSource {
  dataDir: string;
  name: string;
  description?: string;
}

interface ExtendedDataSource extends DataSource {
  bucket: s3.Bucket;
}

export interface KnowledgeBaseProps{
  prefix: string;
  region: string;
  dataSources: DataSource[];
  extraBuckets?: string[];
  name: string;
  description?: string;
  embeddingModelId: EmbeddingModelId;
}

export class KnowledgeBase extends Construct {
  public readonly knowledgeBaseId: string;
  public readonly knowledgeBaseName: string;
  public readonly dataSourceIds: string[] = [];
  constructor(scope: Construct, id: string, props: KnowledgeBaseProps) {
    super(scope, id);
    const vectorIndexName = 'bedrock-knowledge-base-default';
    const metadataField = 'AMAZON_BEDROCK_METADATA';
    const vectorField = 'bedrock-knowledge-base-default-vector';
    const textField = 'AMAZON_BEDROCK_TEXT_CHUNK';
    const dataSourcePrefix = 'data-source/'

    const dataSourcesWithBuckets: ExtendedDataSource[] = props.dataSources.map(dataSource => {
      const bucket = new BucketDeployment(this,`Bucket`,{
          sourcePaths: [dataSource.dataDir],
          destinationKeyPrefix: dataSourcePrefix
      }).bucket

      return {
        ...dataSource,
        bucket: bucket
      };
    });

    const knowledgeBaseRole = new KnowledgeBaseRole(this, 'KnowledgeBaseRole', {
      buckets: dataSourcesWithBuckets.map(dataSource => dataSource.bucket)
    });

    const knowledgeBaseCollection = new KnowledgeBaseCollection(this, 'KnowledgeBaseCollection', {
      prefix: props.prefix,
      collectionName: props.name,
      vectorIndexName: vectorIndexName,
      embeddingModelId: props.embeddingModelId,
      knowledgeBaseRoleArn: knowledgeBaseRole.arn,
      metadataField: metadataField,
      textField: textField,
      vectorField: vectorField,
    });

    knowledgeBaseRole.grantRead(knowledgeBaseCollection.collectionArn)

    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, `${props.prefix}KnowledgeBase`, {
      name: `${props.prefix}${props.name}`,
      roleArn: knowledgeBaseRole.arn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${props.region}::foundation-model/${props.embeddingModelId}`,
        },
      },
      description: props.description || '',
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: knowledgeBaseCollection.collectionArn,
          fieldMapping: {
            metadataField,
            textField,
            vectorField,
          },
          vectorIndexName,
        },
      },
    });
    this.knowledgeBaseName = knowledgeBase.name;
    knowledgeBase.node.addDependency(knowledgeBaseRole);
    knowledgeBase.node.addDependency(knowledgeBaseCollection)

    
    for (const dataSource of dataSourcesWithBuckets) {
      this.dataSourceIds.push(new bedrock.CfnDataSource(this, `${props.prefix}DataSource`,{
        dataSourceConfiguration:{
          s3Configuration:{
            bucketArn: dataSource.bucket.bucketArn,
            inclusionPrefixes: [dataSourcePrefix],
          },
          type: 'S3',
        },
        vectorIngestionConfiguration: {
          chunkingConfiguration: {
            chunkingStrategy: 'FIXED_SIZE',
            fixedSizeChunkingConfiguration: {
              maxTokens: 1000,
              overlapPercentage: 20,
            },
          },
        },
        knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
        name: `${props.prefix}${dataSource.name}`,
        description: dataSource.description || ''
      }).attrDataSourceId);
    }

    this.knowledgeBaseId = knowledgeBase.ref

  }
}