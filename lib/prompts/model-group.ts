import { ModelId, ModelGroup } from '../types/model';

export const MODEL_GROUP_MAP: Record<ModelId, ModelGroup> = {
  'anthropic.claude-3-5-haiku-20241022-v1:0': 'claude3.5',
  'anthropic.claude-3-5-sonnet-20241022-v2:0': 'claude3.5',
  'anthropic.claude-3-5-sonnet-20240620-v1:0': 'claude3.5',
};