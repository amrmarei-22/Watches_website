# Order States

## 1. Statuses
`PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED`

| Status | Meaning |
|--------|---------|
| PENDING | Order placed by customer; awaiting admin review |
| CONFIRMED | Admin verified the order (e.g., phoned the customer) |
| PROCESSING | Being prepared/packed |
| SHIPPED | Handed to courier |
| DELIVERED | Received by customer. **Terminal.** |
| CANCELLED | Cancelled. **Terminal.** Stock restored. |

## 2. Transition table (exhaustive — everything not listed is illegal)
| From | To | Actor | Required input | Side effects |
|------|----|-------|----------------|--------------|
| PENDING | CONFIRMED | ADMIN | — | history entry |
| PENDING | CANCELLED | CUSTOMER (own) or ADMIN | ADMIN: reason required. CUSTOMER: reason optional | restore stock |
| CONFIRMED | PROCESSING | ADMIN | — | history entry |
| CONFIRMED | CANCELLED | ADMIN | reason required | restore stock |
| PROCESSING | SHIPPED | ADMIN | tracking number (optional, 0–50 chars) | history entry |
| PROCESSING | CANCELLED | ADMIN | reason required | restore stock |
| SHIPPED | DELIVERED | ADMIN | — | history entry |

Not allowed (examples): DELIVERED → anything; CANCELLED → anything; SHIPPED → CANCELLED; SHIPPED → PROCESSING; skipping steps (PENDING → SHIPPED). 
Backward moves are not allowed in v1. If admin made a mistake, they cannot undo; a v2 decision.

## 3. Visual
```
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
   │          │           │
   └──────────┴───────────┴──► CANCELLED
```

## 4. Rules
- 4.1 Each transition appends a StatusHistory entry `{from, to, actorId, actorRole, reason, timestamp}`.
- 4.2 Transition + side effects (stock restore) happen in ONE transaction.
- 4.3 Concurrent changes: use optimistic check on current status (`UPDATE ... WHERE id=? AND status=<expected>`). If 0 rows updated → 409 `ORDER_STATUS_CHANGED` and UI reloads the order.
- 4.4 Customer sees status + history timeline; customer cannot see internal admin reasons for non-cancel transitions. Cancellation reason entered by admin IS shown to the customer.
- 4.5 Admin UI shows only the buttons for transitions legal from the current status (derived from the same table).

## 5. Who sees what action
| Status | Customer actions | Admin actions |
|--------|------------------|---------------|
| PENDING | Cancel | Confirm, Cancel |
| CONFIRMED | — | Start processing, Cancel |
| PROCESSING | — | Mark shipped, Cancel |
| SHIPPED | — | Mark delivered |
| DELIVERED | — | — |
| CANCELLED | — | — |
