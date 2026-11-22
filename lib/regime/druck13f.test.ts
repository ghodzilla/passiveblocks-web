import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { analyseFilings, parseInfoTable, pick13fFilings, pickInfoTableName, presentFiling, sampleFilingReport, type HoldingLine } from './druck13f';

const CONFIG = 'lib/regime/druck.config.ts';

function line(partial: Partial<HoldingLine> & Pick<HoldingLine, 'issuer' | 'cusip' | 'value' | 'shares'>): HoldingLine {
  return { title: 'COM', putCall: '', ...partial };
}

const XML = `<?xml version="1.0"?>
<informationTable>
<infoTable><nameOfIssuer>Natera Inc</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>632307104</cusip><value>100</value><shrsOrPrnAmt><sshPrnamt>10</sshPrnamt></shrsOrPrnAmt></infoTable>
<infoTable><nameOfIssuer>Natera Inc</nameOfIssuer><titleOfClass>COM</titleOfClass><cusip>632307104</cusip><value>40</value><shrsOrPrnAmt><sshPrnamt>4</sshPrnamt></shrsOrPrnAmt><putCall>Call</putCall></infoTable>
<infoTable><nameOfIssuer>Ishares Inc</nameOfIssuer><titleOfClass>MSCI BRAZIL ETF</titleOfClass><cusip>464286400</cusip><value>20</value><shrsOrPrnAmt><sshPrnamt>8</sshPrnamt></shrsOrPrnAmt></infoTable>
</informationTable>`;

describe('Duquesne 13F', () => {
  it('parses the information table and keeps calls apart from the shares', () => {
    const rows = parseInfoTable(XML);
    assert.equal(rows.length, 3);
    const stock = rows.find((row) => row.issuer === 'Natera Inc' && !row.putCall);
    const calls = rows.find((row) => row.putCall === 'Call');
    assert.equal(stock?.shares, 10);
    assert.equal(calls?.shares, 4);
    assert.equal(pickInfoTableName(['primary_doc.xml', 'form13f_20260930.xml']), 'form13f_20260930.xml');
    assert.equal(pickInfoTableName(['primary_doc.xml']), null);
  });

  it('prefers an amended filing for the same quarter', () => {
    const picked = pick13fFilings({
      filings: {
        recent: {
          form: ['13F-HR', '13F-HR/A', '13F-HR', '10-Q'],
          accessionNumber: ['0001-25-000001', '0001-25-000002', '0001-25-000003', '0001-25-000004'],
          filingDate: ['2025-11-14', '2025-11-20', '2026-02-14', '2026-02-01'],
          reportDate: ['2025-09-30', '2025-09-30', '2025-12-31', '2025-12-31'],
        },
      },
    });
    assert.equal(picked.length, 2);
    assert.equal(picked[0]?.report, '2025-12-31');
    assert.equal(picked[1]?.accession, '0001-25-000002');
    assert.equal(picked[1]?.form, '13F-HR/A');
  });

  it('diffs new, added, trimmed, and exited lines, and checks Natera against 15%', () => {
    const before = readFileSync(CONFIG, 'utf8');
    const previous = [
      line({ issuer: 'Natera Inc', cusip: '632307104', value: 140, shares: 10 }),
      line({ issuer: 'Seagate Technology Hldngs Pl', cusip: 'G7945M107', value: 40, shares: 10 }),
      line({ issuer: 'Western Digital Corp', cusip: '958102105', value: 10, shares: 4 }),
      line({ issuer: 'Cash Fund', cusip: '000000001', value: 80, shares: 1 }),
    ];
    const latest = [
      line({ issuer: 'Natera Inc', cusip: '632307104', value: 10, shares: 10 }),
      line({ issuer: 'Seagate Technology Hldngs Pl', cusip: 'G7945M107', value: 30, shares: 8 }),
      line({ issuer: 'Palantir Technologies Inc', cusip: '69608A108', value: 25, shares: 5 }),
      line({ issuer: 'Cash Fund', cusip: '000000001', value: 80, shares: 1 }),
    ];
    const analysis = analyseFilings(previous, latest);
    assert.equal(analysis.counts.new, 1);
    assert.equal(analysis.counts.trimmed, 1);
    assert.equal(analysis.counts.exited, 1);
    assert.equal(analysis.counts.added, 0);
    assert.equal(analysis.natera.under15, true);
    assert.ok((analysis.natera.weight ?? 1) < 0.15);
    assert.match(analysis.flags.join(' '), /under 15%/);
    assert.match(analysis.flags.join(' '), /does not sell by itself/);
    assert.match(analysis.flags.join(' '), /Western Digital/);
    assert.match(analysis.suggestions.join(' '), /Palantir/);
    assert.match(analysis.suggestions.join(' '), /Suggestion only/);
    assert.match(analysis.suggestions.join(' '), /not changed/);
    assert.equal(readFileSync(CONFIG, 'utf8'), before);
    const source = readFileSync('lib/regime/druck13f.ts', 'utf8');
    assert.equal(source.includes('writeFile'), false);
    assert.equal(source.includes('druck.config.ts'), false);

    const heavy = analyseFilings(
      [line({ issuer: 'Natera Inc', cusip: '632307104', value: 50, shares: 10 })],
      [line({ issuer: 'Natera Inc', cusip: '632307104', value: 80, shares: 12 }), line({ issuer: 'Other', cusip: '111111111', value: 20, shares: 1 })],
    );
    assert.equal(heavy.natera.under15, false);
    assert.match(heavy.flags.join(' '), /not broken/);
    assert.equal(heavy.counts.added, 1);

    const gone = analyseFilings(
      [line({ issuer: 'Natera Inc', cusip: '632307104', value: 50, shares: 10 })],
      [line({ issuer: 'Other', cusip: '111111111', value: 20, shares: 1 })],
    );
    assert.equal(gone.natera.exited, true);
    assert.match(gone.flags.join(' '), /no longer reports Natera/);
  });

  it('shows an empty card until a filing is saved', () => {
    const empty = presentFiling({ status: 'empty', report: null });
    assert.match(empty.headline, /No 13F is saved yet/);
    assert.match(empty.headline, /not changed/);
    const sample = sampleFilingReport();
    const card = presentFiling({ status: 'ok', report: sample });
    assert.match(card.headline, /16 Nov 2026/);
    assert.match(card.lines.join(' '), /Palantir/);
    assert.match(card.flags.join(' '), /not broken/);
    assert.match(card.footnote, /share count/);
  });
});
