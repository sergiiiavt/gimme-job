# Підсумковий проєкт і довідник команд

## Результати

Доведіть, що вмієте зібрати, пояснити, запустити, перевірити, замінити та дослідити цілий застосунок. Локальна вправа використовує Python API, том SQLite і окремий контейнер перевірок; хмарний обліковий запис, вхід до реєстру чи зовнішні залежності застосунку не потрібні.

## Файли та поведінка

Отримайте [приклад із репозиторію](https://github.com/sergiiiavt/gimme-job/tree/main/examples/docker-learning). Якщо копії ще немає:

```sh
git clone https://github.com/sergiiiavt/gimme-job.git
cd gimme-job/examples/docker-learning
```

| Файл | Призначення |
| --- | --- |
| `app.py` | HTTP API, транзакційний лічильник, здоров’я та коректна зупинка |
| `checks.py` | API-перевірки з іншого контейнера |
| `Dockerfile` | Непривілейований образ і health check |
| `.dockerignore` | Явне обмеження файлів збірки |
| `compose.yaml` | Сервіси, публікація на loopback, том і обмеження |
| `test_capstone.py` | Перевірки застосунку без залежності від Docker |

`GET /health` перевіряє читання бази, `GET /counter` читає значення, `POST /counter` збільшує його. Невідомі GET/POST-маршрути повертають JSON 404. Probe не змінює даних і не гарантує кожний майбутній запис. API без автентифікації та HTTP-сервер стандартної бібліотеки Python призначені для локального навчання.

## Збирання, перевірка та заміна

З директорії прикладу:

```sh
docker compose config --quiet
docker compose up --build -d --wait --wait-timeout 90
docker compose --profile checks run --rm --no-deps checks
curl --fail http://127.0.0.1:18080/counter
docker compose up -d --force-recreate --wait --wait-timeout 90 api
docker compose --profile checks run --rm --no-deps checks --require-existing
```

Обидва запуски перевірок мають завершитися кодом 0. Другий має знайти ненульовий лічильник після заміни. Перша збірка потребує доступу до реєстру базового образу. Якщо порт хоста зайнятий, задайте інший `DOCKER_COURSE_PORT`; внутрішня адреса API не змінюється.

## Дослідження обмежень

```sh
docker compose exec api id
docker compose exec api python -c "from pathlib import Path; Path('/app/write-test').write_text('blocked')"
docker compose logs --tail 30 api
```

Очікуйте UID 10001. Запис у `/app` має завершитися помилкою через кореневу файлову систему лише для читання. Записи API до `/data` мають працювати. Поясніть користь скидання capabilities, no-new-privileges, ліміту процесів і ротації журналів, не називаючи їх доказом повної безпеки.

## Вправа з відновлення

Створіть узгоджену копію SQLite командами розділу про сховища. Прочитайте її, відновіть в окреме тимчасове середовище з правильним власником і перевірте лічильник. Під час тренування не переписуйте початковий том.

Зупиніть стек через `docker compose down`, запустіть знову й підтвердьте збереження. `down --volumes` використовуйте лише для навмисного скидання навчальних даних. Поясніть різницю між видаленням образу, контейнера й тому.

## Довідник команд

| Завдання | Команда |
| --- | --- |
| Демон і контекст | `docker info`, `docker context show` |
| Образи та диск | `docker image ls`, `docker system df` |
| Підсумкова модель | `docker compose config --quiet` |
| Запуск з очікуванням | `docker compose up -d --wait` |
| Стан і журнали | `docker compose ps -a`, `docker compose logs --tail 50 api` |
| Запуск перевірок | `docker compose --profile checks run --rm --no-deps checks` |
| Заміна API | `docker compose up -d --force-recreate --wait api` |
| Зупинка й видалення стека | `docker compose down` |

Команда перевірок очікує вже готовий API. Перед змінами чи видаленням ресурсів перевіряйте контекст і проєкт.

## Підсумкове завдання та відповідь

**Завдання:** Поясніть провал готовності, доведіть збереження після заміни, визначте користувача та доступні для запису шляхи, потім опишіть безпечний реліз і відкат.

**Критерії відповіді:** Потрібні стан здоров’я і журнали, успішні контейнерні перевірки до й після заміни, UID і монтування, визначений артефакт релізу, перевірене відновлення й сумісність схеми. Перед публічним production додайте належний сервер, автентифікацію, TLS, копії поза хостом і моніторинг.

## Підсумок

Маршрут завершено, коли ви пояснюєте як успішний запуск, так і причини відмов. Продовжуйте [Cloud & DevOps](/learn/cloud-devops), [мережі](/learn/networking) або [автоматизацію тестування](/learn/automation) відповідно до системи, яку потрібно побудувати чи перевірити.

## Sources

- [Повний код](https://github.com/sergiiiavt/gimme-job/tree/main/examples/docker-learning)
- [Compose](https://docs.docker.com/compose/)
- [Томи](https://docs.docker.com/engine/storage/volumes/)
- [Виконання контейнерів](https://docs.docker.com/engine/containers/run/)
