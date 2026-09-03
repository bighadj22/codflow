Open SearchSearch
Keyboard Shortcut:Command⌘ k
Introduction

Close Group - Introduction
Sending an email
Verified domains
Quotas count recipients, not emails
Credits
Suppressed recipients are skipped, not charged
Retrying safely
Sending limits, and why a send can be delayed
Webhooks

Open Group - Webhooks
Errors
Emails

Close Group - Emails
List sent emails
HTTP Method: GET
Send an email
HTTP Method: POST
Send up to 500 emails in one request
HTTP Method: POST
Retrieve an email
HTTP Method: GET
Templates

Open Group - Templates
Suppressions

Open Group - Suppressions
Webhooks

Open Group - Webhooks
Account

Open Group - Account
Domains

Open Group - Domains
Models

Open Group - Models
Open API Client
Powered by Scalar

v1.0.0
OpenAPI 3.1.0
Sendili API

Download OpenAPI Document

Download OpenAPI Document
Send transactional and marketing email over HTTP.

Every request is authenticated with your API key: Authorization: Bearer sk_live_...

Sending an email
POST /v1/emails returns 200 with a message_id as soon as the email is accepted. Use that id with GET /v1/emails/{message_id} to follow it.

A 200 means accepted, not delivered. The email is dispatched to the provider a moment later, and delivery itself is confirmed by the receiving mail server after that. Check the message status for the outcome — never treat the send response as proof of delivery.

Verified domains
The domain in from must be verified in your workspace. Verifying acme.com also authorises every subdomain, so mail.acme.com works without a second verification. GET /v1/account lists the domains you may send from.

Quotas count recipients, not emails
An email addressed to 10 people costs 10 against your daily quota, not 1. Every response reports the recipients it consumed, and GET /v1/account reports your rolling 24-hour usage.

Credits
One credit sends to one recipient. The same email to 10 people costs 10 credits — the identical rule as the quota above, so your bill and your sending limit can never disagree with each other.

Credits never expire. There is no plan and no monthly fee.

They are held at the account level and shared by every workspace you own. Topping up in one workspace tops up all of them.

When the balance runs out, sends are refused with 402 insufficient_credits and the message names both the cost and your balance. Mail already queued is unaffected and still goes out. This is deliberately not a 429.

We email the account owner once when the balance runs low, and again if it reaches zero.

Suppressed recipients are skipped, not charged
When an address hard-bounces or reports spam, it is added to your workspace’s suppression list and we stop delivering to it. That list is yours alone — one customer’s bounces never suppress another customer’s recipients.

If a send includes an address we already know is suppressed, we drop that recipient before charging you and list it in suppressed_recipients on the response. The remaining recipients are sent and billed normally. If every recipient is suppressed, nothing is charged and the message is recorded with status rejected, so you can still find it with GET /v1/emails/{message_id}.

Manage the list with GET, POST and DELETE /v1/suppressions.

Retrying safely
Send an Idempotency-Key header on any send. If the request times out and you retry with the same key and the same body, you get the original message_id back and no second email is sent. Without a key, a retry sends a second real email — the underlying provider performs no deduplication of its own.

Sending limits, and why a send can be delayed
Sendili paces delivery so one sender can never slow down another. Bulk sends are drained at your fair share of the sending rate, which means a large campaign is delivered over time rather than all at once — a message can sit at queued for a while, and that is normal.

You never need to add retry or throttling code for this. GET /v1/account reports what you have used and what is left.

A 429 means we are declining to accept more right now. Honour Retry-After and the request will succeed.

Webhooks
Register an HTTPS endpoint with POST /v1/webhooks and we will POST you a JSON event when mail is delivered, bounces, or is marked as spam.

Every request carries these headers:

Header	Meaning
X-Sendili-Event	delivered, bounced, complained, delayed, rejected or failed
X-Sendili-Delivery	Unique per attempt. Dedupe on this.
X-Sendili-Timestamp	When we sent it
X-Sendili-Signature	sha256=<hex>
Verifying the signature
Compute HMAC-SHA256 over <timestamp>.<raw body> using your secret and compare it with the header. Use the raw request body — if your framework parses and re-serialises the JSON first, the bytes change and the signature will not match.

import crypto from "node:crypto";

app.post("/webhooks/sendili", express.raw({ type: "application/json" }), (req, res) => {
  const ts = req.header("X-Sendili-Timestamp");
  const expected = "sha256=" + crypto
    .createHmac("sha256", process.env.SENDILI_WEBHOOK_SECRET)
    .update(ts + "." + req.body)
    .digest("hex");

  const given = req.header("X-Sendili-Signature") || "";
  if (given.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return res.sendStatus(401);
  }

  res.sendStatus(200);            // acknowledge first
  handle(JSON.parse(req.body));   // then do your work
});
Reject anything whose timestamp is more than five minutes old — that is what stops a captured request being replayed at you later.

What to expect
Reply with a 2xx within 10 seconds, then process asynchronously. Anything else is treated as a failure and retried.
Retries back off over about a day. A 4xx is not retried, except 408 and 429 — we take it to mean your server understood and refused.
An endpoint that keeps failing is paused, and the dashboard says so. Fix it and re-enable; the failure count resets.
The same event can arrive twice. Dedupe on X-Sendili-Delivery.
GET /v1/webhooks/{id}/deliveries shows what we sent and what your server answered — start there when something is not arriving.

Errors
Every failure returns the same shape: a type you can branch on, a message for humans, and a request_id to quote if you contact support. Validation failures add issues, naming each bad field by its path (to.1, attachments.0.filename).

Server
Server:
https://api.sendili.com

Authentication
Required
Selected Auth Type:bearerAuth
Your API key: Authorization: Bearer sk_live_…
Bearer Token
:
Token
Show Password
Client Libraries
Shell Curl
Emails ​Copy link
EmailsOperations
get
/v1/emails
post
/v1/emails
post
/v1/emails/batch
get
/v1/emails/{id}
List sent emails​Copy link

Auth Required
Your sending history for the last 15 days, newest first.

Combine status, domain and search freely — they narrow the same list. search matches the subject, the sender, any recipient, the Sendili message id and the provider message id.

Paging is by cursor, not page number. Pass the next_cursor from the previous response as ?cursor=. A cursor never repeats or skips a row, even while new mail is arriving — a page number would.

Responses contain the index only. Use GET /v1/emails/{message_id} for the body, headers and attachments of one message.

Query Parameters
statusCopy link to status
Type:string
enum
queued — accepted, waiting · sending — in flight · sent — the provider accepted it (NOT proof of delivery) · delayed — a transient problem; the provider is still retrying · delivered — the recipient’s mail server accepted it · failed — see error · rejected — the provider took it and did not deliver · bounced — permanently rejected · complained — delivered, then marked as spam.

values
queued
sending
sent
delayed
delivered
failed
rejected
bounced
complained
domainCopy link to domain
Type:string
Sender domain, e.g. acme.com. Matched exactly, not by suffix.

searchCopy link to search
Type:string
max length:  
200
Free text across subject, sender, recipients and both message ids. % and _ are literal.

limitCopy link to limit
Type:integer
min:  
1
max:  
100
Default
Integer numbers.

cursorCopy link to cursor
Type:string
The next_cursor from a previous response.

Responses

200
A page of messages, newest first.
application/json

400
The request body is not valid JSON, or is not a JSON object or array.
application/json

401
Missing, malformed, unknown or revoked API key.
application/json

402
Out of credits. Nothing was sent and nothing was charged. Unlike a 429 this does not resolve by waiting — top up at sendili.com/billing.
application/json

403
Workspace not provisioned, sending disabled, or sender domain not verified.
application/json

422
Invalid query parameter or cursor.
application/json

429
Sending rate or daily quota exceeded. Honour Retry-After.
application/json

500
Unexpected error on our side.
application/json

502
The email provider is temporarily unavailable. Safe to retry.
application/json
Request Example forget/v1/emails
Shell Curl
curl https://api.sendili.com/v1/emails \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN'


Test Request
(get /v1/emails)
Status:200
Status:400
Status:401
Status:402
Status:403
Status:422
Status:429
Status:500
Status:502
{
  "data": [
    {
      "id": "string",
      "status": "string",
      "lane": "transactional",
      "provider_message_id": null,
      "from": "string",
      "to": [
        "string"
      ],
      "subject": "string",
      "recipients": 1,
      "attempts": 1,
      "error": null,
      "created_at": "2026-09-03T02:22:43.210Z",
      "sent_at": null
    }
  ],
  "next_cursor": null,
  "has_more": true
}

A page of messages, newest first.

Send an email​Copy link

Auth Required
Send a single email to one or more recipients.

from and the recipient fields accept either a string ("Acme <hi@acme.com>") or an object ({ "email": "...", "name": "..." }), and recipient fields accept one address or an array.

Up to 50 recipients across to, cc and bcc combined.

Headers
Idempotency-KeyCopy link to Idempotency-Key
Type:string
max length:  
255
Retrying with the same key and the same body replays the original result rather than sending again.

Body
·SendEmail
required
application/json
fromCopy link to from
required

Any of
string
Type:string
toCopy link to to
required

Any of
Schema

Any of
string
Type:string
attachmentsCopy link to attachments
Type:array object[]
Show Child Attributesfor attachments
bccCopy link to bcc

Any of
Schema

Any of
string
Type:string
categoryCopy link to category
Type:string
enum
values
transactional
marketing
ccCopy link to cc

Any of
Schema

Any of
string
Type:string
headersCopy link to headers
Type:object
Show Child Attributesfor headers
htmlCopy link to html
Type:string
reply_toCopy link to reply_to

Any of
Schema

Any of
string
Type:string
subjectCopy link to subject
Type:string
tagsCopy link to tags
Type:array object[]
…50
Show Child Attributesfor tags
templateCopy link to template
Type:object
Show Child Attributesfor template
Show additional propertiesfor Request Body
Responses

200
Accepted. Follow it with GET /v1/emails/{message_id}. If every recipient was suppressed the message is recorded as rejected and nothing is charged.
application/json

400
The request body is not valid JSON, or is not a JSON object or array.
application/json

401
Missing, malformed, unknown or revoked API key.
application/json

402
Out of credits. Nothing was sent and nothing was charged. Unlike a 429 this does not resolve by waiting — top up at sendili.com/billing.
application/json

403
Workspace not provisioned, sending disabled, or sender domain not verified.
application/json

409
Idempotency-Key reused with a different body, or still in flight.
application/json

413
Request body over 20 MB.
application/json

422
Validation failed. See issues for the offending fields.
application/json

429
Sending rate or daily quota exceeded. Honour Retry-After.
application/json

500
Unexpected error on our side.
application/json

502
The email provider is temporarily unavailable. Safe to retry.
application/json
Request Example forpost/v1/emails
Shell Curl
curl https://api.sendili.com/v1/emails \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
  --data '{
  "from": "",
  "to": "",
  "cc": "",
  "bcc": "",
  "reply_to": "",
  "subject": "",
  "html": "",
  "text": "",
  "template": {
    "name": "",
    "subject": "",
    "html": "",
    "text": "",
    "data": {}
  },
  "headers": {
    "additionalProperty": ""
  },
  "attachments": [
    {
      "filename": "",
      "content": "",
      "content_type": "",
      "disposition": "ATTACHMENT",
      "content_id": "",
      "description": "",
      "encoding": "BASE64"
    }
  ],
  "tags": [
    {
      "name": "",
      "value": ""
    }
  ],
  "category": "transactional"
}'


Test Request
(post /v1/emails)
Status:200
Status:400
Status:401
Status:402
Status:403
Status:409
Status:413
Status:422
Status:429
Status:500
Status:502
{
  "message_id": "msg_5dc2573dfe504e53bcddca311c07de9f",
  "recipients": 1,
  "suppressed_recipients": [
    "bounced@example.com"
  ],
  "created_at": "2026-09-03T02:22:43.210Z"
}

Accepted. Follow it with GET /v1/emails/{message_id}. If every recipient was suppressed the message is recorded as rejected and nothing is charged.

Send up to 500 emails in one request​Copy link

Auth Required
Send up to 500 independent emails in one request. Each one can have its own recipients, subject, body, sender and attachments.

base + requests
Put anything shared by every message in base, and only what differs in each entry of requests. An entry is merged over base and the result must be a valid POST /v1/emails body — there are no batch-only fields and no batch-only rules.

a field in an entry wins
a field an entry omits is inherited from base
a field set to null in an entry clears the inherited value
template is the one field that merges one level deep, so base can name the template while each entry supplies its own template.data.

base is optional. Put every field in each entry and you have a plain list of unrelated messages.

One recipient per entry
Give each entry a single address in to and every person gets their own email. Putting many people in one to is a normal CC — they will all see each other's addresses, which is almost never what a newsletter wants.

Order, categories and limits
data comes back in the order you sent, so data[3] is the message id for requests[3]. Each id works with GET /v1/emails/{message_id} exactly like a single send.

Set category to marketing for campaigns and newsletters; it keeps them in a separate lane so they cannot delay your transactional mail. The default is transactional.

Limits: 500 messages, 5,000 recipients in total, 50 addresses per message (to + cc + bcc), and 20 MB for the whole request.

Validation is all-or-nothing: if any message is invalid the whole request is rejected and nothing is sent, so it is always safe to fix and resend.

Headers
Idempotency-KeyCopy link to Idempotency-Key
Type:string
max length:  
255
Retrying with the same key and the same body replays the original result rather than sending again.

Body
·SendBatch
required
application/json
requestsCopy link to requests
Type:array object[]
1…500
required
Empty object
Show Child Attributesfor requests
baseCopy link to base
Type:object
Empty object
Show Child Attributesfor base
Responses

200
Accepted. One message id per message, in request order.
application/json

400
The request body is not valid JSON, or is not a JSON object or array.
application/json

401
Missing, malformed, unknown or revoked API key.
application/json

402
Out of credits. Nothing was sent and nothing was charged. Unlike a 429 this does not resolve by waiting — top up at sendili.com/billing.
application/json

403
Workspace not provisioned, sending disabled, or sender domain not verified.
application/json

409
Idempotency-Key reused with a different body, or still in flight.
application/json

413
Request body over 20 MB.
application/json

422
Validation failed, or template.name does not exist in this workspace. Nothing was sent.
application/json

429
Sending rate or daily quota exceeded. Honour Retry-After.
application/json

500
Unexpected error on our side.
application/json

502
The email provider is temporarily unavailable. Safe to retry.
application/json
Request Example forpost/v1/emails/batch
Shell Curl
curl https://api.sendili.com/v1/emails/batch \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
  --data '{
  "base": {},
  "requests": [
    {}
  ]
}'


Test Request
(post /v1/emails/batch)
Status:200
Status:400
Status:401
Status:402
Status:403
Status:409
Status:413
Status:422
Status:429
Status:500
Status:502
{
  "data": [
    {
      "message_id": "string",
      "suppressed_recipients": [
        "string"
      ]
    }
  ],
  "recipients": 1,
  "created_at": "2026-09-03T02:22:43.210Z"
}

Accepted. One message id per message, in request order.

Retrieve an email​Copy link

Auth Required
Path Parameters
idCopy link to id
Type:string
required
The message_id returned when you sent the email.

Responses

200
The email and its current status.
application/json

400
The request body is not valid JSON, or is not a JSON object or array.
application/json

401
Missing, malformed, unknown or revoked API key.
application/json

402
Out of credits. Nothing was sent and nothing was charged. Unlike a 429 this does not resolve by waiting — top up at sendili.com/billing.
application/json

403
Workspace not provisioned, sending disabled, or sender domain not verified.
application/json

404
No such message, or it belongs to another workspace.
application/json

429
Sending rate or daily quota exceeded. Honour Retry-After.
application/json

500
Unexpected error on our side.
application/json

502
The email provider is temporarily unavailable. Safe to retry.
application/json
Request Example forget/v1/emails/{id}
Shell Curl
curl 'https://api.sendili.com/v1/emails/{id}' \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN'


Test Request
(get /v1/emails/{id})
Status:200
Status:400
Status:401
Status:402
Status:403
Status:404
Status:429
Status:500
Status:502
{
  "id": "string",
  "status": "queued",
  "lane": "transactional",
  "provider_message_id": null,
  "from": "string",
  "to": [
    "string"
  ],
  "subject": "string",
  "recipients": 1,
  "attempts": 1,
  "error": null,
  "created_at": "2026-09-03T02:22:43.210Z",
  "sent_at": null,
  "detail": {
    "cc": [
      "string"
    ],
    "bcc": [
      "string"
    ],
    "reply_to": null,
    "html": null,
    "text": null,
    "headers": [
      {}
    ],
    "attachments": [
      {}
    ],
    "template": null,
    "tags": [
      "string"
    ]
  },
  "detail_available": true
}

The email and its current status.

Templates (Collapsed)​Copy link
TemplatesOperations
post
/v1/templates
get
/v1/templates
get
/v1/templates/{name}
put
/v1/templates/{name}
delete
/v1/templates/{name}
Show More
Suppressions (Collapsed)​Copy link
SuppressionsOperations
get
/v1/suppressions
post
/v1/suppressions
get
/v1/suppressions/{email}
delete
/v1/suppressions/{email}
Show More
Webhooks (Collapsed)​Copy link
WebhooksOperations
get
/v1/webhooks
post
/v1/webhooks
get
/v1/webhooks/{id}
put
/v1/webhooks/{id}
delete
/v1/webhooks/{id}
get
/v1/webhooks/{id}/deliveries
get
/v1/deliveries
Show More
Account (Collapsed)​Copy link
AccountOperations
get
/v1/account
get
/health
Show More
Domains (Collapsed)​Copy link
DomainsOperations
get
/v1/domains
Show More
