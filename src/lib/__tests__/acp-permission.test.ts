import { describe, expect, it } from 'vitest';

import { createACPPermissionAction } from '../acp-permission';

describe('createACPPermissionAction', () => {
  it('preserves ExitPlanMode option ids separately from display labels', () => {
    const action = createACPPermissionAction({
      sessionId: 'session-1',
      toolCall: {
        toolCallId: 'tool-1',
        kind: 'switch_mode',
        title: 'Ready to code?',
        rawInput: {
          plan: '# Plan\n\nImplement it.',
        },
      },
      options: [
        {
          optionId: 'acceptEdits',
          name: 'Yes, and auto-accept edits',
          kind: 'allow_always',
        },
        {
          optionId: 'plan',
          name: 'No, keep planning',
          kind: 'reject_once',
        },
      ],
    });

    expect(action.content?.questions?.[0]).toMatchObject({
      question: 'Ready to code?',
      header: 'Exit Plan Mode',
      options: [
        { label: 'Yes, and auto-accept edits', value: 'acceptEdits' },
        { label: 'No, keep planning', value: 'plan' },
      ],
    });
    expect(action.content?.plan).toBe('# Plan\n\nImplement it.');
  });

  it('uses structured ExitPlanMode content when rawInput is unavailable', () => {
    const action = createACPPermissionAction({
      sessionId: 'session-1',
      toolCall: {
        toolCallId: 'tool-1',
        kind: 'switch_mode',
        content: [
          {
            type: 'content',
            content: { type: 'text', text: '# Fallback plan' },
          },
        ],
      },
      options: [],
    });

    expect(action.content?.plan).toBe('# Fallback plan');
  });
});
