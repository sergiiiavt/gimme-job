# Практична лабораторія Claude Code

Виконуйте вправи в scratch-copy. Налаштування наведені як приклад і не встановлюються автоматично.

## 1: project-memory

Перевірте фактичні test/build commands і напишіть коротке guidance без credentials. Поясніть різницю project/user scope та спосіб перевірити завантажені правила.

## 2: explore і plan

Дослідіть discount та незалежну таблицю 0/5/10/20%. За потреби опишіть мінімальний fix, потім перевірте 99/100 обох ролей. Збережіть diff і commands, не лише повідомлення агента.

## 3: reviewer

Передайте іншому контексту вимогу й diff. Попросіть відтворюваний failure з input/expected/actual; перевірте кожну знахідку незалежно. Свіжий reviewer також може помилитися.

## 4: blocking-hook

Надішліть synthetic Write/Edit-event для .env.training та answer.py. Перевірте exit2/stderr проти exit0; malformed input теж має явно відмовляти. Це не універсальний sandbox для Bash або backend.

## 5: context

Збережіть вимогу, важливі facts, source-pointers і test-results перед compact. Перевірте, чи після нього правильні boundary-очікування; clear не є recovery persisted-files.

## Що зберегти

Короткий requirement-to-case map, diff, незалежний oracle, результати tests і межі hook. Не публікуйте credentials, приватні logs або чужі дані.

## Виконувана база

[Пакет](https://github.com/sergiiiavt/gimme-job/tree/main/examples/certification-practice): `python examples/certification-practice/practice.py claude-code`. Reference проходить; starter через --candidate падає до реалізації. Виконайте hook-tests окремо. Інжектуйте wrong outcome й покажіть rejection; це локальні fixtures, не доказ live-сумісності всіх версій CLI.
