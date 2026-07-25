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
});
