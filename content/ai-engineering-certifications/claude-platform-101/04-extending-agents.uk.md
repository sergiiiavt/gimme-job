# Розширення агентів

Додавайте можливість лише разом із чіткою відповідальністю, доступом і перевіркою.

## Built-in tools

Деякі server-tools виконує провайдер; інші client-tools виконує ваш застосунок. Підтримка залежить від model/platform та конфігурації. Перевірте typed-input/output, вартість і помилки конкретної feature.

## Skills

Процедура з пов’язаними матеріалами допомагає повторюваності. Вона не створює зовнішніх прав і не замінює execution-validation. Перевірте актуальний спосіб передачі skill у своєму runtime.

## MCP

MCP стандартизує integration-contract для context/resources і tools. Секрети, scope та approval керуються окремо. Використовуйте одну визначену revision, не змішуйте її envelope із іншими версіями.

## Context-management

Trim до релевантного, reserve-output, зберігайте sourced facts і pointers. Compaction стискає, але не гарантує збереження кожного числа. Cache й retrieval мають власні expiry/access правила.

## Managed agents

Hosted-runtime може надати sessions, state та sandbox-можливості. Перевірте сервісний контракт, availability і власні data/approval/evaluation вимоги. Managed не означає автоматично безпечний або правильний результат.

## Building із Code

Coding-agent може створювати прототип, але ви перевіряєте залежності, contracts і generated-code. Розділяйте local-lab та production secrets/side effects; зелений happy-path не покриває failure-recovery.

## Вибір за відповідальністю

Built-in feature→перевірка platform support; skill→процедура; MCP→integration; harness→state/budgets/recovery. Для довгих задач persist перевірені facts і pointers. Compaction не є durable storage, а managed-service не забирає відповідальність за власний процес.
