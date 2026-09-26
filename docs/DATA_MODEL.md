# غَرْسة — data model notes

The full table of Firestore/Storage paths (who writes, who reads) is in CLAUDE.md §12.
This file records model changes and open TODOs that span the app, web and rules.

## `parents/{uid}/children/{childId}.schedule`

| field | type | notes |
|---|---|---|
| `days` | `string[]` | lesson weekdays: `sat` `sun` `mon` `tue` `wed` `thu` `fri` (≥ 1) |
| `time` | `int` | minutes after midnight (0–1439) |
| `custom` | `map<day,int>` | per-day time overrides, only for chosen days |
| `duration` | `30 \| 45 \| 60` | daily cap in minutes |
| `reminder` | `bool` | remind the child before the lesson |
| `reviewDay` | `string?` | **design/v3** — the weekly review session's day; must be one of `days`. Optional so older clients (and the Flutter app today) stay valid. |

There is no memorization-level field: the "مستوى الحفظ" concept was removed (design/v3 review).

## TODO — one child on the monthly plan (server enforcement)

design/v3 `PackagesLimit`: the monthly plan covers **one** child; adding a second asks the parent
to upgrade to the annual plan. Today this is enforced **only in the UI** (web add-child flow and the
Flutter add-child flow).

Planned enforcement (not done yet):

1. `parents/{uid}.childCount` — written only by the server: Cloud Function triggers `onCreate` /
   `onDelete` on `parents/{uid}/children/{childId}` update it with the Admin SDK (clients can't write it;
   the `parents/{uid}` update rule already only allows `name`/`email`).
2. `maxChildren` derived from the plan (`monthly` → 1, `annual` → unlimited), server-written with
   the subscription.
3. `firestore.rules` → children `create` requires `childCount < maxChildren`, with allow + deny cases
   in `app/tool/rules_test/rules.test.mjs`.

The rule is marked `TODO(child-limit)` in `app/firestore.rules`.
