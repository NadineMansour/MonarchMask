// Utility functions for masking numeric content
// These functions are global when loaded in the extension but can also be
// imported in Node for testing.

/**
 * Regex for numbers and common currency formats.
 * Matches strings like "$12.34", "100" or "99%".
 */
const BASIC_NUMBER_REGEX = /(\$|€|£|¥)\s*\d+(?:[.,]\d+)*(?:\.\d+)?|\b\d+(?:[.,]\d+)*(?:\.\d+)?(?:\s*%)?/g;

/** Regex for any sequence of digits. */
const DIGIT_SEQUENCE_REGEX = /\d+/g;

/**
 * Mask numeric values in the provided text using bullet characters.
 *
 * @param {string} text - Raw text that may contain numeric values.
 * @returns {string} - Masked text with numbers replaced by "•••".
 */
function maskText(text) {
  if (!text) return text;
  let result = text.replace(BASIC_NUMBER_REGEX, '•••');
  if (/\d/.test(result)) {
    result = result.replace(DIGIT_SEQUENCE_REGEX, '•••');
  }
  return result;
}

// Export for tests when running under Node.
if (typeof module !== 'undefined') {
  module.exports = { maskText, BASIC_NUMBER_REGEX, DIGIT_SEQUENCE_REGEX };
}
