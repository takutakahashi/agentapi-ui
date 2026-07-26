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
    content?: unknown;
    rawInput?: unknown;
  };
  options: ACPPermissionOption[];
}

function extractPlanText(toolCall: ACPPermissionParams['toolCall']): string | undefined {
  let rawInput = toolCall.rawInput;
  if (typeof rawInput === 'string') {
    try {
      rawInput = JSON.parse(rawInput);
    } catch {
      // Fall through to the structured content.
    }
  }

  if (
    rawInput &&
    typeof rawInput === 'object' &&
    'plan' in rawInput &&
    typeof rawInput.plan === 'string'
  ) {
    return rawInput.plan;
  }

  if (!Array.isArray(toolCall.content)) return undefined;

  const text = toolCall.content
    .map((item) => {
      if (!item || typeof item !== 'object' || !('content' in item)) return undefined;
      const content = item.content;
      if (
        !content ||
        typeof content !== 'object' ||
        !('type' in content) ||
        content.type !== 'text' ||
        !('text' in content) ||
        typeof content.text !== 'string'
      ) {
        return undefined;
      }
      return content.text;
    })
    .filter((item): item is string => Boolean(item));

  return text.length > 0 ? text.join('\n\n') : undefined;
}

export function createACPPermissionAction(params: ACPPermissionParams): PendingAction {
  const switchingMode = params.toolCall?.kind === 'switch_mode';
  const plan = switchingMode ? extractPlanText(params.toolCall) : undefined;
  return {
    type: 'answer_question',
    tool_use_id: params.toolCall?.toolCallId ?? '',
    content: {
      ...(plan ? { plan } : {}),
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
