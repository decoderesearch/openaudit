// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { centerMessage } from './snippet-focus';

/** A 400px scroll box with a message at `at`px of its content, `height`px high. */
function setup(at: number, height: number) {
  const box = document.createElement('div');
  box.setAttribute('data-scroll', '');
  box.style.overflowY = 'auto';
  const content = document.createElement('div');
  const el = document.createElement('div');
  content.append(el);
  box.append(content);
  document.body.append(box);
  Object.defineProperty(box, 'clientHeight', { value: 400 });
  Object.defineProperty(el, 'offsetHeight', { value: height });
  box.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  el.getBoundingClientRect = () => ({ top: at - box.scrollTop }) as DOMRect;
  let scrollTop = 0;
  Object.defineProperty(box, 'scrollTop', { get: () => scrollTop, set: (v: number) => (scrollTop = v) });
  return { box, el };
}

describe('centerMessage', () => {
  it('puts a short message in the middle of the box', () => {
    const { box, el } = setup(1000, 100);
    centerMessage(el);
    expect(box.scrollTop).toBe(1000 - 150);
  });

  it('keeps 100px of the chat above a message taller than the box', () => {
    const { box, el } = setup(1000, 2000);
    centerMessage(el);
    expect(box.scrollTop).toBe(900);
  });
});
