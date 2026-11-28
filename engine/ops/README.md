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

`hl-engine.service` runs `ops/hl-engine-sim`.

- One recorded replay of `fixtures/mainnet` into
  `/var/lib/hl-engine/pb-engine.sqlite3`, and only when that file has
  no equity row yet. A second start does not walk the tape again.
- Then it stays up, tells systemd it is healthy every 20 seconds, and
  once an hour trims old health, risk, and outbox rows and vacuums the
  database. The shadow book is not deleted.
- `--live-data` is refused by the command and is not in the unit. The
  service may open only a local Unix socket (`RestrictAddressFamilies=AF_UNIX`),
  which is what the systemd watchdog uses. It cannot open a market connection.
- No `EnvironmentFile`. Nothing in the unit is a key, a token, or a
  database URL.

`Type=notify` and `WatchdogSec=60` need `systemd-notify`, which Ubuntu
already ships. `NotifyAccess=all` is set because the shell calls
`systemd-notify` rather than the Python process. The Python package
does not read the process environment.

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

## Starting it, by hand

The unit stays disabled until you say so. On the droplet, as root,
after a manual replay looks right:

```bash
sudo -u hlengine /opt/hl-engine/.venv/bin/pb-engine \
  run-once --replay /opt/hl-engine/app/fixtures/mainnet \
  --db /var/lib/hl-engine/pb-engine.sqlite3

sudo systemctl enable --now hl-engine.service
sudo systemctl status hl-engine.service
```

To stop it without enabling a restart loop:

```bash
sudo systemctl disable --now hl-engine.service
```

## Not in this install

A live market connection, an order path, a key, a Neon migration, a
Telegram sender, a healthchecks.io ping, a weekly calibration timer,
and any change to Estait. Calibration is not a unit yet because that
job does not exist and a second timer would compete for a nearly full
disk.
