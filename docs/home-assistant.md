# Home Assistant summary proposal

`GET https://hot-tub-time-machine.tarek-rached.workers.dev/api/ha/summary` is a read-only endpoint for Home Assistant. The app remains the only place that writes test readings and maintenance events.

It requires `Authorization: Bearer <token>`. Its response contains the latest displayed value (`value` and `reading_at`), the latest initial test reading (`tested_at`), `days_since`, the existing app cadence in `cadence_days`, and a cadence `status` of `current`, `due`, `overdue`, or `never`. An after-treatment reading can be newer than `tested_at`; this matches the dashboard, which displays the latest value but bases cadence on the initial (`before`) reading. `maintenance` contains the ten newest event types and timestamps.

## Full history API

The compact summary remains the default. Add `history=1` to receive chronological test readings and chemical additions instead:

```text
GET /api/ha/summary?history=1&since=2026-01-01T00:00:00Z&limit=200
```

`since` is optional, inclusive, and must be an ISO date. Each result contains a `history` array and `next_cursor`. Readings include the session ID, test type, phase, PPM value, raw drops, sample size, and timestamp. Additions include the session ID, chemical, ounces, and timestamp. Results are sorted by timestamp, then type and ID. The default page size is 200 records and `limit` may be 1 through 500. To read all records, request the same `history=1`, `since`, and `limit` with the returned `cursor` until `next_cursor` is `null`; URL-encode the cursor value.

```text
GET /api/ha/summary?history=1&since=2026-01-01T00:00:00Z&limit=200&cursor=2026-01-03%2010%3A00%3A00%7Creading%7C42
```

History mode has the same bearer-token requirement as the compact summary. It is intended for a deliberate one-off importer or another consumer that owns pagination, not for a dashboard poll.

## Worker secret

After the branch is merged and deployed, set a long random token as the Worker secret from this repository's root:

```sh
npx wrangler secret put HA_SUMMARY_TOKEN
```

This command needs Tarek's Cloudflare API token. Enter the token only at Wrangler's prompt; do not put it in `wrangler.toml`, a `.dev.vars` file, git, or command output.

## HA configuration

The account's live HA configuration is on HAOS VM 101, in `/config/configuration.yaml`; `/config/secrets.yaml` is alongside it. The `homelab` repository contains source records of some HA changes, not the live files. This is a proposal only: do not copy it into either location until the Worker endpoint has been deployed and its secret set.

Add the bearer value to `/config/secrets.yaml` (the `Bearer ` prefix is intentional):

```yaml
hot_tub_ha_summary_authorization: "Bearer REPLACE_WITH_THE_WORKER_TOKEN"
```

Then add this top-level `rest:` block to `/config/configuration.yaml`. If that file already has a `rest:` key, add this resource beneath it rather than creating a second key. The 30-minute scan interval keeps the dashboard fresh without frequent Worker reads.

```yaml
rest:
  - resource: https://hot-tub-time-machine.tarek-rached.workers.dev/api/ha/summary
    method: GET
    headers:
      Authorization: !secret hot_tub_ha_summary_authorization
    scan_interval: 1800
    timeout: 15
    sensor:
      - name: Hot Tub pH
        unique_id: hot_tub_ph
        value_template: "{{ value_json.tests.ph.value }}"
        json_attributes_path: "$.tests.ph"
        json_attributes:
          - reading_at
          - tested_at
          - days_since
          - cadence_days
          - status
      - name: Hot Tub Bromine
        unique_id: hot_tub_bromine
        unit_of_measurement: ppm
        value_template: "{{ value_json.tests.bromine.value }}"
        json_attributes_path: "$.tests.bromine"
        json_attributes:
          - reading_at
          - tested_at
          - days_since
          - cadence_days
          - status
      - name: Hot Tub Total Alkalinity
        unique_id: hot_tub_total_alkalinity
        unit_of_measurement: ppm
        value_template: "{{ value_json.tests.ta.value }}"
        json_attributes_path: "$.tests.ta"
        json_attributes:
          - reading_at
          - tested_at
          - days_since
          - cadence_days
          - status
      - name: Hot Tub Calcium Hardness
        unique_id: hot_tub_calcium_hardness
        unit_of_measurement: ppm
        value_template: "{{ value_json.tests.calcium.value }}"
        json_attributes_path: "$.tests.calcium"
        json_attributes:
          - reading_at
          - tested_at
          - days_since
          - cadence_days
          - status
      - name: Hot Tub Latest Maintenance
        unique_id: hot_tub_latest_maintenance
        value_template: "{{ value_json.maintenance[0].event_type if value_json.maintenance else 'none' }}"
        json_attributes:
          - maintenance
```

Run HA's configuration check and restart or reload the REST integration after the edit. The four chemistry sensors expose their due state as the `status` attribute, so a dashboard can show it directly and a future reminder automation can trigger on `due` or `overdue` without duplicating cadence numbers.

## HA history backfill

Do not point the REST sensors above at `history=1` for backfill. The [RESTful Sensor integration](https://www.home-assistant.io/integrations/sensor.rest/) polls an endpoint and updates the current entity state and selected attributes; a later poll replaces those values. It does not import the returned timestamps into HA's recorder, and it cannot page through the response. At most, history mode could place one bounded page in an attribute, which is neither recorder history nor a durable backfill.

For a real numeric-history backfill, build a separate one-shot HA custom integration or importer that fetches every history page and sends selected readings through HA's recorder statistics import API. The API supports `recorder/import_statistics`, but it requires statistics metadata and unit semantics that changed in recent HA versions, as documented in HA's [recorder statistics API notice](https://developers.home-assistant.io/blog/2025/10/16/recorder-statistics-api-changes/). Decide before implementing it whether to import before readings, after readings, or both, and map pH and PPM units correctly. Chemical additions are event records, not a natural long-term statistic; leave them in this app unless there is a separate HA event-log design. This repository does not include an importer or make any HA changes.

## Observed testing cadence

The committed `seeds/historical.sql` is a production export last refreshed in February 2026. It covers 32 sessions from 2025-06-25 through 2026-02-15. Session gaps had a 7-day median, a 6-9 day interquartile range, and a 1-17 day range. pH was tested in all 32 sessions, so it has the same distribution.

| Initial test reading | Sessions | Median gap | Interquartile range | Range |
|---|---:|---:|---:|---:|
| pH | 32 | 7 days | 6-9 days | 1-17 days |
| Bromine | 23 | 9 days | 6.25-14 days | 1-25 days |
| Total Alkalinity | 9 | 31 days | 15.25-35.25 days | 5-56 days |
| Calcium Hardness | 8 | 17 days | 10.5-24.5 days | 5-127 days |

The data supports replacing the weekly OmniFocus repeater with an HA reminder driven by pH's endpoint status: the observed session and pH median is exactly seven days, with most gaps between six and nine days. Keep the app's 21-day TA and calcium cadence for now; the observed gaps are sparse and variable. This export is stale, so refresh `seeds/historical.sql` from production and rerun these figures before treating them as a current behavioral baseline.
