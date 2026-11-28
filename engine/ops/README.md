# Hyperliquid engine on the existing Sydney droplet

**NOT VALIDATED. Simulation only. No keys. No orders.**

This is the install for Pritesh's current DigitalOcean droplet, hostname
Abbi-CEO, Sydney, 2 vCPU, about 3.8 GB of RAM, shared with the Estait
app. It is not a new box and it is not `pb-engine-01`. The engine is a
guest. Estait keeps the rest of the machine.

The system user `hlengine` (nologin, home `/opt/hl-engine`) and these
directories already exist, mode 750, owned by `hlengine`:

- `/opt/hl-engine` — code and the uv virtualenv
- `/var/lib/hl-engine` — the SQLite file
- `/var/log/hl-engine` — app logs

## What gets installed

`ops/install.sh` is idempotent. Run it as root from a checkout of this
repo, on the droplet. It does not create the user, does not download
uv, does not write an env file, and does not enable or start the
service.

```bash
sudo bash engine/ops/install.sh
```

It copies the engine to `/opt/hl-engine/app`, builds the virtualenv at
`/opt/hl-engine/.venv` with `uv sync --frozen`, and installs only these
files outside the three directories above:

- `/etc/systemd/system/hl-engine.slice`
- `/etc/systemd/system/hl-engine.service`
- `/etc/systemd/system/pb-alert@.service`
- `/etc/logrotate.d/hl-engine`

It then runs `systemctl daemon-reload`. It does not touch Estait, ssh,
the firewall, journald, or any other unit.

uv must already be on root's PATH. If it is not, install uv so that it
lands under `/opt/hl-engine` (the hlengine home) and retry. Do not put
a key in that install.

## What the service does

`hl-engine.service` runs `ops/hl-engine-sim`, a live paper loop.

- Each pass runs `pb-engine run-once --live-data`. That reads public
  mainnet info and the public websocket, then one simulated cycle: stale
  data blocks new entries, the daily universe filter records who is
  eligible, and the gate, closer, risk limits, and session calendars are
  the ones the replay already uses.
- SQLite at `/var/lib/hl-engine/pb-engine.sqlite3` is always written.
  If `HL_DATABASE_URL` is set, the same rows are copied into schema `hl`.
  A failed copy is logged without the URL and the loop stays up. The
  outbox stays in SQLite.
- The loop tells systemd it is healthy before each pass. Once an hour it
  trims old health, risk, and outbox rows and vacuums. The shadow book
  is not deleted.
- The unit may open a Unix socket for the watchdog, plus TCP
  (`AF_INET` and `AF_INET6`) for the public Hyperliquid host and the
  database host. `ProtectSystem=strict` is unchanged.
  `ReadWritePaths` is still only `/var/lib/hl-engine` and
  `/var/log/hl-engine`. `/etc/hl-engine` is readable, not writable.
- `EnvironmentFile=/etc/hl-engine/engine.env`. The unit file does not
  contain a key, a token, or a database URL.

`Type=notify` and `WatchdogSec=60` need `systemd-notify`, which Ubuntu
already ships. `NotifyAccess=all` is set because the shell calls
`systemd-notify` rather than the Python process. The only environment
variable the package reads is `HL_DATABASE_URL`.

`Restart=always` with `RestartSec=30` is in the unit, so once the
service is started it comes back after a crash. The install does not
start it. The 30 second gap is there so a bad start cannot fill the
disk with a tight restart loop.

## Caps, so Estait is not starved

On a 2 vCPU box, systemd treats `CPUQuota=100%` as one whole CPU.
`CPUQuota=60%` is a bit over half of one CPU. The other one and a half
CPUs stay available.

| Setting | Value | Why |
| --- | --- | --- |
| CPUQuota | 60% | Hard CPU cap. 100% would mean one full CPU. |
| MemoryHigh | 700M | Soft pressure starts here. |
| MemoryMax | 900M | Hard stop. The box has about 3.8 GB. |
| IOWeight | 20 | Default is 100, so the engine loses disk ties. |
| TasksMax | 64 | One simulation process does not need more. |
| Nice | 10 | Prefer other work when the CPU is busy. |
| OOMScoreAdjust | 400 | Under memory pressure, prefer killing the engine over Estait. |

The spec's `MemoryLow=1500M` and `CPUWeight=1000` are not used. Those
would reserve memory and CPU for the engine on a box that is already
shared. `OOMScoreAdjust=-500` from the spec is not used for the same
reason.

## Logs and the database

The disk is nearly full, so the app log is capped without touching the
system journal. logrotate keeps the current file plus 8 rotations at
10 MB each, compressed after the first rotation. That is at most about
90 MB, under a 200 MB ceiling. `copytruncate` is used because the
service keeps the file open.

`pb-engine prune` keeps the last 48 health rows, 200 risk events, and
100 outbox rows, then vacuums. If the file is still over 32 MB it
keeps even fewer of those rows. It does not delete strategies, signals,
or shadow trades. The service runs this once an hour.

## Failure notes

If the service fails, `pb-alert@hl-engine.service` runs
`pb-engine alert-fail`. That queues one warning in the local SQLite
outbox and sends nothing. The same unit name in the same hour does not
add a second row. There is no Telegram sender and no token file.

## The env file, before you restart

Create this yourself. The install script does not write it, and it is
not in git.

```bash
sudo install -d -m 755 -o root -g root /etc/hl-engine
sudo install -m 600 -o root -g root /dev/null /etc/hl-engine/engine.env
```

The only variable the engine reads is `HL_DATABASE_URL`. Put the Neon
connection string for the writer role in that file, one line. If the
variable is absent, paper mode still runs
and writes only SQLite. Do not put a key, a token, or a Telegram URL in
the file.

The file has to exist before the new unit starts. systemd refuses the
service when `EnvironmentFile=` is missing. An empty file is enough for
SQLite-only paper mode.

## Starting it, by hand

The unit is already enabled on the droplet. The install script still
does not enable or start it. After the env file is in place, as root:

```bash
sudo bash engine/ops/install.sh
sudo systemctl restart hl-engine.service
sudo systemctl status hl-engine.service
```

To stop it without enabling a restart loop:

```bash
sudo systemctl disable --now hl-engine.service
```

## Not in this install

An order path, a key, a role, a grant, a Telegram sender, a
healthchecks.io ping, a weekly calibration timer, and any change to
Estait. Roles `hl_engine` and `hl_reader`, and their grants, are a later
hardening step. The schema file does not create them. Calibration is
not a unit yet because that job does not exist and a second timer would
compete for a nearly full disk.
