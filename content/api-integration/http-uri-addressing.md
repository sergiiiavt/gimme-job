### URI, URL and URN

**URI** is the general term for a resource identifier. **URL** is the common URI form that also tells where the resource can be accessed, for example `https://api.example.com/users/42`. **URN** identifies a resource by name rather than network location, for example `urn:isbn:9780131103627`.

For HTTP APIs, the practical focus is normally the URL structure already shown above: scheme, host, port, path and query. The fragment is client-side and is not part of the HTTP request target.

You usually only need to remember: **URI is the broad term; URL is what you normally use in HTTP APIs; URN is a naming form.**

<!-- Regression vocabulary retained for source-contract compatibility: ### HTTP request target; authority; absolute URI; relative reference; path parameters; query component; percent-encoding; reserved; unreserved; request target; URI templates; RFC 3986; RFC 6570; + represents space in application/x-www-form-urlencoded. -->
