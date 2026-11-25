# Практична лабораторія CTFL

Виведіть очікувані значення до читання reference-коду. Потрібні репозиторій і Python3.10+, без AI та ключів API.

## Вимоги та покриття

Домен віку — всі цілі; валідно 18–65. EP має 3 класи, 2-value BVA:17,18,65,66; 3-value:16,17,18,19,64,65,66,67. Повторіть для 1–1.

Знижки: member та subtotal>=100→20%; лише member→10%; лише велика сума→5%; інакше 0%. Перевірте 99/100 обох ролей і відмову для від’ємної суми. Стани: draft/submit→submitted; submitted/approve→approved; submitted/reject→draft; approved/archive→archived. Спробуйте archived/approve окремо як невалідний перехід.

## Виконати, зламати й пояснити

У [пакеті практики](https://github.com/sergiiiavt/gimme-job/tree/main/examples/certification-practice) запустіть `python examples/certification-practice/practice.py ctfl`: reference проходить. Скопіюйте starter.py, реалізуйте три функції й передайте шлях через --candidate. Незавершений starter навмисно падає.

Замініть >=100 на >100 і покажіть відмову oracle. Збережіть таблицю вимога→тест, очікування/факт та exit status. Успіх покриває ці fixtures, не весь силабус чи всю можливу поведінку системи.
