export type ModelId = 
  | 'anthropic.claude-3-haiku-20240307-v1:0' 
  | 'anthropic.claude-3-5-haiku-20241022-v1:0'
  | 'anthropic.claude-3-5-sonnet-20240620-v1:0'
  | 'anthropic.claude-3-5-sonnet-20241022-v2:0';
export type ModelGroup = 'claude3' | 'claude3.5';

export type EmbeddingModelId = 
  | 'amazon.titan-embed-text-v2:0'
  | 'cohere.embed-multilingual-v3';
export type ModelVectorMapping = Record<EmbeddingModelId, string>;
