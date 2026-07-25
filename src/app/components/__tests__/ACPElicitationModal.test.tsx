import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ACPElicitationModal from '../ACPElicitationModal';

describe('ACPElicitationModal', () => {
  it('submits selected, multi-selected, and custom AskUserQuestion answers', () => {
    const onSubmit = vi.fn();
    render(
      <ACPElicitationModal
        elicitation={{
          sessionId: 'session-1',
          mode: 'form',
          message: 'Please answer the following questions.',
          requestedSchema: {
            type: 'object',
            properties: {
              question_0: {
                type: 'string',
                title: 'Color',
                oneOf: [
                  { const: 'Blue', title: 'Blue' },
                  { const: 'Green', title: 'Green' },
                ],
              },
              question_1: {
                type: 'array',
                title: 'Tools',
                items: {
                  anyOf: [
                    { const: 'Bash', title: 'Bash' },
                    { const: 'Git', title: 'Git' },
                  ],
                },
              },
              question_1_custom: {
                type: 'string',
                title: 'Other',
              },
            },
          },
        }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Blue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bash' }));
    fireEvent.click(screen.getByRole('button', { name: 'Git' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Mercurial' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));

    expect(onSubmit).toHaveBeenCalledWith({
      question_0: 'Blue',
      question_1: ['Bash', 'Git'],
      question_1_custom: 'Mercurial',
    });
  });
});
