// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { DownloadButton } from '@/components/DownloadButton';

interface Row {
  id: number;
  name: string;
}

const columns = [
  { header: 'id', value: (r: Row) => r.id },
  { header: 'name', value: (r: Row) => r.name },
];

afterEach(cleanup);

describe('DownloadButton', () => {
  it('says how many rows it will write and under what name', () => {
    render(<DownloadButton fileName="rewards.csv" columns={columns} rows={[{ id: 1, name: 'a' }]} />);
    expect(screen.getByText('CSV').closest('button')!.title).toBe('Download 1 rows as rewards.csv');
  });

  it('is disabled with nothing to export', () => {
    render(<DownloadButton fileName="rewards.csv" columns={columns} rows={[]} />);
    const button = screen.getByText('CSV').closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toBe('Nothing to export');
  });

  it('writes a CSV blob under the given name when clicked', async () => {
    const created: Blob[] = [];
    let downloadName = '';

    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: (blob: Blob) => {
        created.push(blob);
        return 'blob:stub';
      },
      revokeObjectURL: () => {},
    });

    // jsdom does not implement navigation, so record the click rather than
    // letting it try to follow the blob URL.
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadName = this.download;
      });

    render(
      <DownloadButton
        fileName="rewards_welcome-box.csv"
        columns={columns}
        rows={[{ id: 30039, name: 'Balance Rp100' }]}
      />,
    );
    await userEvent.setup().click(screen.getByText('CSV'));

    expect(downloadName).toBe('rewards_welcome-box.csv');
    expect(created).toHaveLength(1);
    expect(created[0]!.type).toContain('text/csv');

    // The BOM has to be checked on the bytes: Blob.text() decodes as UTF-8 and
    // a UTF-8 decode strips a leading BOM by spec. It is still written to disk,
    // which is what makes Excel read the file as UTF-8.
    const bytes = new Uint8Array(await created[0]!.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);

    const text = await created[0]!.text();
    expect(text).toContain('id,name');
    expect(text).toContain('30039,Balance Rp100');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
