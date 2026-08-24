const UKRAINIAN_LOCATION_ALIASES = [
  ["Вся Украина", "Вся Україна"],
  ["Белгород-Днестровский", "Білгород-Дністровський"],
  ["Каменец-Подольский", "Кам’янець-Подільський"],
  ["Ивано-Франковск", "Івано-Франківськ"],
  ["Днепропетровск", "Дніпро"],
  ["Белая Церковь", "Біла Церква"],
  ["Кривой Рог", "Кривий Ріг"],
  ["Кировоград", "Кропивницький"],
  ["Кропивницкий", "Кропивницький"],
  ["Нововолынск", "Нововолинськ"],
  ["Константиновка", "Костянтинівка"],
  ["Славянск", "Слов’янськ"],
  ["Черноморск", "Чорноморськ"],
  ["Запорожье", "Запоріжжя"],
  ["Хмельницкий", "Хмельницький"],
  ["Черновцы", "Чернівці"],
  ["Чернигов", "Чернігів"],
  ["Мариуполь", "Маріуполь"],
  ["Кременчуг", "Кременчук"],
  ["Краматорск", "Краматорськ"],
  ["Дружковка", "Дружківка"],
  ["Александрия", "Олександрія"],
  ["Дрогобыч", "Дрогобич"],
  ["Коломыя", "Коломия"],
  ["Винница", "Вінниця"],
  ["Николаев", "Миколаїв"],
  ["Тернополь", "Тернопіль"],
  ["Харьков", "Харків"],
  ["Одесса", "Одеса"],
  ["Черкассы", "Черкаси"],
  ["Бердянск", "Бердянськ"],
  ["Мелитополь", "Мелітополь"],
  ["Каменское", "Кам’янське"],
  ["Никополь", "Нікополь"],
  ["Покровск", "Покровськ"],
  ["Борисполь", "Бориспіль"],
  ["Вышгород", "Вишгород"],
  ["Вишневое", "Вишневе"],
  ["Васильков", "Васильків"],
  ["Бровары", "Бровари"],
  ["Ирпень", "Ірпінь"],
  ["Обухов", "Обухів"],
  ["Фастов", "Фастів"],
  ["Львов", "Львів"],
  ["Киев", "Київ"],
  ["Днепр", "Дніпро"],
  ["Ровно", "Рівне"],
  ["Луцк", "Луцьк"],
  ["Сумы", "Суми"],
  ["Стрый", "Стрий"],
  ["Измаил", "Ізмаїл"],
  ["Украина", "Україна"],
  ["удалённо", "віддалено"],
  ["удаленно", "віддалено"],
] as const;

function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const aliasByLowerCase = new Map(
  UKRAINIAN_LOCATION_ALIASES.map(([legacy, canonical]) => [legacy.toLocaleLowerCase("uk-UA"), canonical]),
);
const aliasPattern = new RegExp(
  `(?<!\\p{L})(?:${[...UKRAINIAN_LOCATION_ALIASES]
    .sort(([left], [right]) => right.length - left.length)
    .map(([legacy]) => regexEscape(legacy))
    .join("|")})(?!\\p{L})`,
  "giu",
);

/**
 * Canonicalize known Ukrainian locations leaked by legacy/alternate-language
 * job-board feeds. This is deliberately limited to the location field; vacancy
 * titles, company names, and descriptions remain source-authored content.
 */
export function normalizeUkrainianLocation(value: unknown): string {
  const location = typeof value === "string" || typeof value === "number"
    ? String(value).replace(/\s+/g, " ").trim()
    : "";
  if (!location) return "";

  return location.replace(aliasPattern, (match) => (
    aliasByLowerCase.get(match.toLocaleLowerCase("uk-UA")) ?? match
  ));
}
