import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WithheldReply } from './hazard-note';

const URL = 'https://openaudit.com/runs/r/attempts/3';

describe('WithheldReply', () => {
  it('shows the heading and summary, and links "here" to a mail to support', () => {
    render(<WithheldReply level="restricted" summary="The AI gave a plan." url={URL} name="FORTRESS x" />);
    expect(screen.getByText('Conversation Hidden - Dangerous/Harmful Content')).toBeTruthy();
    expect(screen.getByText('The AI gave a plan.')).toBeTruthy();
    expect(screen.getByText(/^This is a summary of this AI's response\. The exact response is hidden/)).toBeTruthy();
    expect(screen.getByText(/^Request the conversation transcript/)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'here' });
    expect(link.getAttribute('href')).toMatch(/^mailto:support@openaudit\.com\?subject=Access%20request/);
  });

  it('does not say a summary shows when there is none', () => {
    render(<WithheldReply level="restricted" summary={null} url={URL} name="x" />);
    expect(screen.queryByText(/summary/)).toBeNull();
    expect(screen.getByText(/^This AI's response is hidden/)).toBeTruthy();
  });

  it('has no link for a level that nobody can ask for', () => {
    render(<WithheldReply level="withheld" summary="The AI gave a plan." url={URL} name="x" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText(/Request the conversation/)).toBeNull();
  });
});
