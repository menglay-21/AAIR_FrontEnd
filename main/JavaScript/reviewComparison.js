(() => {
  const normalize = value => String(value).trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN');
  const canonical = value => value
    .replace(/(\d)[.,](?=\d{3}(?:\D|$))/g, '$1')
    .replace(',', '.')
    .replace(/[.!?]+$/, '');

  function classify(left, right) {
    if (left == null || right == null) return 'MISSING';
    const a = normalize(left), b = normalize(right);
    if (a === b) return 'EXACT';
    return canonical(a) === canonical(b) ? 'FORMAT_ONLY' : 'VALUE_DIFFERENT';
  }

  window.AAIR = window.AAIR || {};
  window.AAIR.reviewComparison = { classify };
})();
