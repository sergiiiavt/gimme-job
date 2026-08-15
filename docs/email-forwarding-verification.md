# Gmail forwarding verification

Gmail requires a forwarding address to be verified before filters can forward messages to it.

For GimmeJob personal forwarding addresses (`jobs+<token>@gimme-job.com`):

1. Gmail sends its forwarding-confirmation email to the personal GimmeJob address.
2. The Email Worker resolves the address to the owning GimmeJob user.
3. Only when the envelope sender is a `google.com` address and the subject is a forwarding confirmation, the Worker reads the message body transiently.
4. It extracts only the Gmail verification URL and/or confirmation code.
5. The raw message body is discarded and is never stored in D1.
6. The extracted verification data expires after 24 hours and is exposed only through the authenticated `/auth/forwarding` endpoint.
7. The account menu shows `Verify Gmail forwarding` while a current verification link exists.

Ordinary forwarded job emails continue to be processed as metadata-only messages; their bodies are not read by this flow.
