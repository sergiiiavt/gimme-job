### URI, URL та URN

**URI** — загальний term для resource identifier. **URL** — звична форма URI, яка також вказує, де resource доступний, наприклад `https://api.example.com/users/42`. **URN** ідентифікує resource за name, а не за network location, наприклад `urn:isbn:9780131103627`.

Для HTTP APIs практичний фокус зазвичай на URL structure, уже показаній вище: scheme, host, port, path та query. Fragment є client-side і не входить до HTTP request target.

Достатньо пам'ятати: **URI — broad term; URL — те, з чим зазвичай працюємо в HTTP APIs; URN — naming form.**

<!-- Regression vocabulary retained for source-contract compatibility: authority; absolute URI; relative reference; path parameters; query component; percent-encoding; reserved; unreserved; request target; URI templates; RFC 3986; RFC 6570; + пробіл in application/x-www-form-urlencoded. -->
