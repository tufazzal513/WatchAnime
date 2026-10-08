# Security Specification: WatchAnime Firestore Rules

## 1. Data Invariants
- Public users can only read content that has `status == 'published'`.
- Content creation, modification, and deletion are strictly limited to authorized Admins (`admins/{uid}`).
- Admin bootstrapping permits initial superadmin with email `mdtufazzal513@gmail.com` to register in `/admins/$(request.auth.uid)`.
- Watchlist and History documents under `/users/{userId}/...` are strictly private to the authenticated owner (`request.auth.uid == userId`). No user can read or modify another user's watchlist or history.
- Content requests can be submitted by authenticated users, but their `status` cannot be altered by ordinary users once created.
- Video reports can be submitted by any user (authenticated or anonymous with valid fields), but only Admins can update their status to `resolved` or `investigating`.
- Site settings and advertisement configurations can only be updated by Admins; all users can read settings.

## 2. The Dirty Dozen Payloads (Target Violations)
1. **Unpublished Content Leak:** Anonymous user requests document with `status: 'draft'`. Must be DENIED.
2. **Unauthorized Movie Injection:** Normal user creates `/content/fake-movie`. Must be DENIED.
3. **Privilege Escalation:** Normal user writes `/admins/my-uid` with role `superadmin`. Must be DENIED.
4. **Watchlist Scraping:** User A attempts to read `/users/userB/watchlist`. Must be DENIED.
5. **Cross-User Watchlist Tampering:** User A writes into `/users/userB/watchlist/item1`. Must be DENIED.
6. **Watch History Poisoning:** User A writes into `/users/userB/history/item1`. Must be DENIED.
7. **Request Status Tampering:** Normal user attempts to change request `status` from `pending` to `approved`. Must be DENIED.
8. **Malicious Content ID Injection:** Attacker injects 2KB string in document path `{contentId}`. Must be DENIED via `isValidId()`.
9. **Settings Overwrite:** Non-admin attempts to replace `/siteSettings/ads` with malicious script. Must be DENIED.
10. **Shadow Key Injection:** User creates a ContentRequest with unauthorized admin flag `{ isAdmin: true }`. Must be DENIED.
11. **Report Resolution by Non-Admin:** User resolves their own or others' report. Must be DENIED.
12. **Blanket User Discovery:** Non-admin attempts to query `/users` collection. Must be DENIED.
