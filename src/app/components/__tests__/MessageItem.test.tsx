import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import MessageItem from '../MessageItem';

describe('MessageItem ACP images', () => {
  it('renders an image-only agent message in the chat', () => {
    render(
      <MessageItem
        message={{
          id: 1,
          role: 'agent',
          content: '',
          images: [{ mimeType: 'image/png', data: 'iVBORw0KGgo=' }],
          time: '2026-07-25T00:00:00Z',
          type: 'normal',
        }}
        formatTimestamp={() => '00:00'}
        fontSettings={{ fontSize: 14, fontFamily: 'sans-serif' }}
      />,
    );

    expect(screen.getByRole('img', { name: 'Message image 1' })).toHaveAttribute(
      'src',
      'data:image/png;base64,iVBORw0KGgo=',
    );
  });

  it('renders an image returned by an agent tool', () => {
    render(
      <MessageItem
        message={{
          id: 1,
          role: 'agent',
          content: JSON.stringify({
            type: 'tool_use',
            name: 'GenerateImage',
            id: 'image-tool-1',
            input: {},
          }),
          time: '2026-07-25T00:00:00Z',
          type: 'normal',
          toolUseId: 'image-tool-1',
        }}
        toolResult={{
          id: 2,
          role: 'tool_result',
          content: '',
          images: [{ mimeType: 'image/png', data: 'generated-image-data' }],
          time: '2026-07-25T00:00:01Z',
          type: 'normal',
          parentToolUseId: 'image-tool-1',
          status: 'success',
        }}
        formatTimestamp={() => '00:00'}
        fontSettings={{ fontSize: 14, fontFamily: 'sans-serif' }}
      />,
    );

    expect(screen.getByRole('img', { name: 'Agent output image 1' })).toHaveAttribute(
      'src',
      'data:image/png;base64,generated-image-data',
    );
  });
});
