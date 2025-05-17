const { maskText } = require('../mask-utils');

describe('maskText', () => {
  test('masks currency values', () => {
    expect(maskText('$123.45')).toBe('•••');
    expect(maskText('Total: €100')).toBe('Total: •••');
  });

  test('masks plain numbers and percentages', () => {
    expect(maskText('Balance 1000')).toBe('Balance •••');
    expect(maskText('5% increase')).toBe('••• increase');
  });

  test('returns original text when no numbers', () => {
    expect(maskText('hello world')).toBe('hello world');
  });
});
