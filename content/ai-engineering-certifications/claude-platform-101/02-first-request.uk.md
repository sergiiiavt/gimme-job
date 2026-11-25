# Перший API-запит і вибір моделі

Застосунок може мати один model-call або складний tool-loop. Контракт і очікування визначають до інтеграції.

## Chat і building

Chat також може підтримувати довгі задачі й tools. Власний застосунок додає свою orchestration, auth, state, error-policy й evaluation. API не виконує автоматично ваші бізнесові перевірки.

## Перший call

Messages запит має model,max_tokens,messages, auth/version headers і optional top-level system. Response містить typed-blocks, stop_reason та usage. Обробляйте non-text blocks і incomplete/error outcomes, а не лише content[0].text.

## Модель за доказами

Порівняйте актуальні tiers на власних cases із critical-slices, latency та cost. Візьміть дешеву модель лише якщо вона проходить потрібну якість; невпевнені випадки ескалюйте за перевіреною policy.

## Передбачувані витрати

Використовуйте дозволені keys/workspaces, limits і пер-task step/deadline/output budgets. Usage — токени, не валютний bill; врахуйте rates, cache/batch і retries. Не логуйтесь credentials або private-content.

## Необов’язковий реальний request

Встановіть офіційний anthropic SDK, надайте ANTHROPIC_API_KEY і задайте ANTHROPIC_MODEL, доступний вашому account. Код нижче потребує мережі й оплачується за usage; він не запускається offline-checker. Pin і перевіряйте сумісність SDK/model, обробляйте stop_reason та перевіряйте зміст відповіді незалежно.

```python
import os
from anthropic import Anthropic

client = Anthropic()
message = client.messages.create(
    model=os.environ["ANTHROPIC_MODEL"],
    max_tokens=128,
    messages=[{"role": "user", "content": "Explain idempotency in one sentence."}],
)
print(message.stop_reason, message.usage)
for block in message.content:
    if block.type == "text":
        print(block.text)
```
