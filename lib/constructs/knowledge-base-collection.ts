import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as aoss from 'aws-cdk-lib/aws-opensearchserverless';
import * as iam from 'aws-cdk-lib/aws-iam';
import {EmbeddingModelId, ModelVectorMapping} from '../types/model'

const UUID = 'BCF7EDFD-EC37-4A75-8E74-E3D06645197E';

const MODEL_VECTOR_MAPPING: ModelVectorMapping = {
  'amazon.titan-embed-text-v2:0': '1024',
  'cohere.embed-multilingual-v3': '1024',
};

interface OpenSearchServerlessIndexProps {
  collectionId: string;
  vectorIndexName: string;
  metadataField: string;
  textField: string;
  vectorField: string;
  vectorDimension: string;
}

class OpenSearchServerlessIndex extends Construct {
  public readonly customResourceHandler: lambda.IFunction;
  public readonly customResource: cdk.CustomResource;

  constructor(
    scope: Construct,
    id: string,
    props: OpenSearchServerlessIndexProps
  ) {
    super(scope, id);

    const customResourceHandler = new lambda.SingletonFunction(this, 'OpenSearchServerlessIndex',{
        runtime: lambda.Runtime.NODEJS_20_X,
        code: lambda.Code.fromAsset('custom-resources'),
        handler: 'oss-index.handler',
        uuid: UUID,
        lambdaPurpose: 'OpenSearchServerlessIndex',
        timeout: cdk.Duration.minutes(15),
      }
    );

    const customResource = new cdk.CustomResource(this, 'CustomResource', {
      serviceToken: customResourceHandler.functionArn,
      resourceType: 'Custom::OssIndex',
      properties: props,
    });

    this.customResourceHandler = customResourceHandler;
    this.customResource = customResource;
  }
}



export interface KnowledgeBaseCollectionProps{
  prefix: string;
  collectionName: string;
  vectorIndexName: string;
  embeddingModelId: EmbeddingModelId;
  knowledgeBaseRoleArn: string;
  metadataField: string;
  textField: string;
  vectorField: string;
}

export class KnowledgeBaseCollection extends Construct {
  public readonly collectionArn: string;
  constructor(scope: Construct, id: string, props: KnowledgeBaseCollectionProps) {
    super(scope, id);

    const collection = new aoss.CfnCollection(this, `${props.prefix}Collection`, {
      name: props.collectionName,
      description: '',
      type: 'VECTORSEARCH',
      standbyReplicas: 'DISABLED',
    });

    this.collectionArn = collection.attrArn;

    const ossIndex = new OpenSearchServerlessIndex(this, 'OssIndex', {
      collectionId: collection.ref,
      vectorIndexName: props.vectorIndexName,
      metadataField: props.metadataField,
      textField: props.textField,
      vectorField: props.vectorField,
      vectorDimension: MODEL_VECTOR_MAPPING[props.embeddingModelId],
    });

    ossIndex.customResourceHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [cdk.Token.asString(collection.getAtt('Arn'))],
        actions: ['aoss:APIAccessAll'],
      })
    );
    const accessPolicy = new aoss.CfnAccessPolicy(this, `${props.prefix}AccessPolicy`, {
      name: props.collectionName,
      policy: JSON.stringify([
        {
          Rules: [
            {
              Resource: [`collection/${props.collectionName}`],
              Permission: [
                'aoss:DescribeCollectionItems',
                'aoss:CreateCollectionItems',
                'aoss:UpdateCollectionItems',
              ],
              ResourceType: 'collection',
            },
            {
              Resource: [`index/${props.collectionName}/*`],
              Permission: [
                'aoss:UpdateIndex',
                'aoss:DescribeIndex',
                'aoss:ReadDocument',
                'aoss:WriteDocument',
                'aoss:CreateIndex',
                'aoss:DeleteIndex',
              ],
              ResourceType: 'index',
            },
          ],
          Principal: [
            props.knowledgeBaseRoleArn,
            ossIndex.customResourceHandler.role?.roleArn,
          ],
          Description: '',
        },
      ]),
      type: 'data',
    });
    const networkPolicy = new aoss.CfnSecurityPolicy(this, `${props.prefix}NetworkPolicy`, {
      name: props.collectionName,
      policy: JSON.stringify([
        {
          Rules: [
            {
              Resource: [`collection/${props.collectionName}`],
              ResourceType: 'collection',
            },
            {
              Resource: [`collection/${props.collectionName}`],
              ResourceType: 'dashboard',
            },
          ],
          AllowFromPublic: true,
        },
      ]),
      type: 'network',
    });

    const encryptionPolicy = new aoss.CfnSecurityPolicy(this,`${props.prefix}EncryptionPolicy`,{
      name: props.collectionName,
      policy: JSON.stringify({
        Rules: [
          {
            Resource: [`collection/${props.collectionName}`],
            ResourceType: 'collection',
          },
        ],
        AWSOwnedKey: true,
      }),
      type: 'encryption',
    });

    collection.node.addDependency(accessPolicy);
    collection.node.addDependency(networkPolicy);
    collection.node.addDependency(encryptionPolicy);

  }
}