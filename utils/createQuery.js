import notIn from "./notIn";
import range from "./range";
import uniq from "./uniq";

/**
 * Return a function that matches results with scores
 * @param {String} text
 */
export default function createQuery(text) {
  const [exact, oneLetterOff, twoLettersOff, letterSegments] = parseQuery(text);
  return function (label) {
    label = Array.isArray(label) ? label : String(label).toLowerCase();
    return (
      baseScore(exact, label) * 49 +
      baseScore(oneLetterOff, label) * 7 +
      baseScore(twoLettersOff, label) / Math.log(label.length / 5) +
      baseScore(letterSegments, label) / (5 * Math.log(label.length / 5))
    );
  };
}
const baseScore = (query, text) =>
  query.reduce((score, part) => {
    return score + (text.includes(part) ? part.length : 0);
  }, 0);
const byLength = (a, b) => b.length - a.length || a.localeCompare(b);

const maxLength = (size) => (e) => e.length < size;
const minLength = (size) => (e) => e.length >= size;
/**
 *
 * @param {String} text
 * @returns
 */
export function parseQuery(text) {
  let exactMatch = text
    .toLowerCase()
    .replace(/[^a-z0-9 , .@]/g, "")
    .split(/[ ,.@]/)
    .filter(Boolean)
    .sort(byLength)
    .filter(uniq);
  const prev = exactMatch.slice();
  if (!exactMatch.every(maxLength(10))) {
    exactMatch = exactMatch
      .map(slice(14, Infinity))
      .flat()
      .concat(exactMatch.filter(maxLength(15)))
      .sort(byLength)
      .filter(uniq);
  }
  const oneLetterOff = exactMatch
    .map(removeOneLetter)
    .flat()
    .sort(byLength)
    .filter(uniq)
    .filter(maxLength(10))
    .filter(minLength(5))
    .filter(notIn(prev));
  Array.prototype.push.apply(prev, oneLetterOff);

  const twoLettersOff = oneLetterOff
    .map(removeOneLetter)
    .flat()
    .sort(byLength)
    .filter(uniq)
    .filter(maxLength(10))
    .filter(minLength(7))
    .filter(notIn(prev));
  Array.prototype.push.apply(prev, twoLettersOff);

  const letterSegments = [];
  for (let i = 8; i > 0; i--)
    Array.prototype.push.apply(
      letterSegments,
      (i > 4 ? oneLetterOff : exactMatch)
        .map(slice(i, i * i))
        .flat()
        .sort(byLength)
        .filter(uniq)
        .filter(notIn(prev))
    );
  return [exactMatch, oneLetterOff, twoLettersOff, letterSegments];
}
/**
 *
 * @param {String} word
 * @returns
 */
const removeOneLetter = (word) => {
  return word.length > 1
    ? range(word.length).map((i) => word.slice(0, i) + word.slice(i + 1))
    : [];
};

/**
 *
 * @param {String} word
 * @returns
 */
const slice = (size, from) => (word) => {
  return word.length > size
    ? range(Math.min(from, word.length) - size + 1).map((i) =>
        word.slice(i, i + size)
      )
    : [];
};
