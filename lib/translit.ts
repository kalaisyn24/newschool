/** Cyrillic (Russian + Kazakh) → Latin, close to passport spelling: "Насыров Бахром" → "Nasyrov Bakhrom". */
const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ә: "a", ғ: "g", қ: "k", ң: "ng", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i",
};

export function transliterate(text: string) {
  return text.replace(/[\p{L}'’-]+/gu, (word) => {
    const allCaps = word.length > 1 && word === word.toUpperCase() && word !== word.toLowerCase();
    let out = "";
    for (const ch of word) {
      const lower = ch.toLowerCase();
      const t = MAP[lower];
      if (t === undefined) out += ch;
      else if (ch !== lower) out += allCaps ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1);
      else out += t;
    }
    return out;
  });
}
