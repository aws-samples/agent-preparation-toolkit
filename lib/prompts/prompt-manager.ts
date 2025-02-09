import { ModelId, ModelGroup, Prompt, CustomPrompt } from '../types';
import { MODEL_GROUP_MAP } from './model-group';
import { DEFAULT_PROMPTS } from './default-prompts';
import { CUSTOM_PROMPTS } from './custom-prompts';

export class PromptManager {
  private getModelGroup(model: ModelId): ModelGroup {
    return MODEL_GROUP_MAP[model];
  }

  private getDefaultPrompts(modelGroup: ModelGroup): Prompt {
    return DEFAULT_PROMPTS[modelGroup];
  }

  private getCustomPrompt(agentPromptsId: string): CustomPrompt | undefined {
    return CUSTOM_PROMPTS.find(prompt => prompt.agentPromptsId === agentPromptsId);
  }

  getPrompts(model: ModelId, agentPromptsId?: string): Prompt {
    const modelGroup = this.getModelGroup(model);
    const defaultPrompts = this.getDefaultPrompts(modelGroup);

    if (!agentPromptsId) {
      return defaultPrompts;
    }

    const customPrompt = this.getCustomPrompt(agentPromptsId);
    if (!customPrompt) {
      return defaultPrompts;
    }

    // カスタムプロンプトとデフォルトプロンプトをマージ
    return {
      ...defaultPrompts,
      ...customPrompt,
    };
  }
}