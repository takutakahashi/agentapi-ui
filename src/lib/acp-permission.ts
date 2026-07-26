import { PendingAction } from '../types/agentapi';

export interface ACPPermissionOption {
  optionId: string;
  name: string;
  kind?: string;
  description?: string;
}

export interface ACPPermissionParams {
  sessionId: string;
  toolCall: {
    toolCallId: string;
    kind?: string;
    title?: string;
  };
  options: ACPPermissionOption[];
}

export function createACPPermissionAction(params: ACPPermissionParams): PendingAction {
  const switchingMode = params.toolCall?.kind === 'switch_mode';
  return {
    type: 'answer_question',
    tool_use_id: params.toolCall?.toolCallId ?? '',
    content: {
      questions: [{
        question: params.toolCall?.title || 'Permission required',
        header: switchingMode ? 'Exit Plan Mode' : 'Permission Required',
        options: (params.options ?? []).map(option => ({
          label: option.name || option.optionId,
          description: option.description || option.kind || '',
          value: option.optionId,
        })),
        multiSelect: false,
      }],
    },
  };
}
