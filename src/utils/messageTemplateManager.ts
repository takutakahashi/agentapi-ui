import { MessageTemplate, MessageTemplateInput } from '../types/messageTemplate';
import { ProfileManager } from './profileManager';

export class MessageTemplateManager {
  private static instance: MessageTemplateManager;

  private constructor() {}

  static getInstance(): MessageTemplateManager {
    if (!MessageTemplateManager.instance) {
      MessageTemplateManager.instance = new MessageTemplateManager();
    }
    return MessageTemplateManager.instance;
  }

  async getTemplatesForProfile(profileId: string): Promise<MessageTemplate[]> {
    const profile = await ProfileManager.getProfile(profileId);
    if (!profile) {
      return [];
    }
    return profile.messageTemplates || [];
  }

  async createTemplate(profileId: string, input: MessageTemplateInput): Promise<MessageTemplate> {
    const profile = await ProfileManager.getProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const newTemplate: MessageTemplate = {
      id: this.generateId(),
      profileId,
      name: input.name,
      content: input.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!profile.messageTemplates) {
      profile.messageTemplates = [];
    }
    profile.messageTemplates.push(newTemplate);

    await ProfileManager.updateProfile(profileId, {
      messageTemplates: profile.messageTemplates,
    });

    return newTemplate;
  }

  async updateTemplate(profileId: string, templateId: string, input: Partial<MessageTemplateInput>): Promise<MessageTemplate> {
    const profile = await ProfileManager.getProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    if (!profile.messageTemplates) {
      throw new Error('No templates found');
    }

    const templateIndex = profile.messageTemplates.findIndex(t => t.id === templateId);
    if (templateIndex === -1) {
      throw new Error('Template not found');
    }

    const updatedTemplate: MessageTemplate = {
      ...profile.messageTemplates[templateIndex],
      ...(input.name && { name: input.name }),
      ...(input.content && { content: input.content }),
      updatedAt: new Date().toISOString(),
    };

    profile.messageTemplates[templateIndex] = updatedTemplate;

    await ProfileManager.updateProfile(profileId, {
      messageTemplates: profile.messageTemplates,
    });

    return updatedTemplate;
  }

  async deleteTemplate(profileId: string, templateId: string): Promise<void> {
    const profile = await ProfileManager.getProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    if (!profile.messageTemplates) {
      return;
    }

    profile.messageTemplates = profile.messageTemplates.filter(t => t.id !== templateId);

    await ProfileManager.updateProfile(profileId, {
      messageTemplates: profile.messageTemplates,
    });
  }

  private generateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const messageTemplateManager = MessageTemplateManager.getInstance();