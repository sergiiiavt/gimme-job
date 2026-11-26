# Підсумкове повторення CCAR-F

Пояснюйте відповідь через контракт і конкретний failure-path, а не запам’ятовану фразу.

## Головне правило

Системну проблему вирішуйте в потрібному шарі: кодові ліміти, явні inputs, evidence-preserving errors та незалежна валідація. Prompt підтримує поведінку, але не створює authorization або джерельний факт.

## Типові distractors

Більша модель замість виправлення інтерфейсу; confidence замість доказу; більше retries без replay-safety; summary замість exact facts; JSON замість семантики; лог після дії замість approval до неї. Поясніть, чому кожен варіант привабливий і недостатній.

## Важливі відмінності

Tool-choice/strict schema; schema/meaning/grounding; model end_turn/task done; resource/tool; project/user config; pre/post hooks; forked context/filesystem isolation; interactive/batch. Для кожної пари створіть контрприклад.
