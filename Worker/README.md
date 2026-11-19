# MoveX Worker server (Worker/Backend)

Read-replica. **No Admin Panel here** (`/admin` and `/assets` do not exist on this server; manage everything from the MAIN server's admin panel).
No npm install needed. Node 22.13+.

1. Main admin panel -> Settings -> Servers & Backup -> Add worker -> copy the `WORKER_KEY` (shown once).
2. Upload the **contents** of this folder to the new server root.
3. Set variables from `.env.example` (`MAIN_URL`, `WORKER_KEY`, `PUBLIC_URL`, `ADMIN_UID`, `ALLOWED_ORIGINS`, `TRUST_PROXY=1`). Start: `npm start`.
4. Frontend needs no change. It finds online workers via the main server's `/api/servers`.

Reads come from the local synced copy; writes and admin API calls are forwarded to main. If main is down, reads continue from the old copy.
No Frontend folder is needed for a worker: the user site is deployed once from `Frontend/`.
