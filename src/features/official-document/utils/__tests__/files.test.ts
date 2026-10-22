import { isOnHost, localFileName, mimeOf, officeFormat } from '../files';

describe('localFileName', () => {
  it('keeps Vietnamese names and drops what file systems refuse', () => {
    expect(localFileName('Công văn 215/CV-UBND: PCCC.pdf', 'pdf')).toBe('Công văn 215_CV-UBND_ PCCC.pdf');
  });

  it('adds .pdf to a PDF whose name lost its extension', () => {
    expect(localFileName('Quyết định 12', 'pdf')).toBe('Quyết định 12.pdf');
    expect(localFileName('Bảng lương.XLSX', 'xls')).toBe('Bảng lương.XLSX');
  });

  it('never returns an empty or hidden name', () => {
    expect(localFileName('  ', 'other')).toBe('tai-lieu');
    expect(localFileName('.env', 'other')).toBe('env');
  });
});

describe('isOnHost', () => {
  const base = 'https://vanthuapi.thaco.com.vn';
  it('matches only the Văn thư API itself', () => {
    expect(isOnHost(`${base}/2026/10/14/a.pdf`, base)).toBe(true);
    expect(isOnHost('https://vanthuapi.thaco.com.vn.evil.io/a.pdf', base)).toBe(false);
    expect(isOnHost('https://example.com/a.pdf', base)).toBe(false);
  });
});

describe('mimeOf', () => {
  it('maps Office and PDF extensions, case-insensitively', () => {
    expect(mimeOf('Tờ trình.DOCX')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(mimeOf('a.pdf')).toBe('application/pdf');
    expect(mimeOf('bang.xls')).toBe('application/vnd.ms-excel');
  });

  it('leaves unknown or missing extensions undefined', () => {
    expect(mimeOf('README')).toBeUndefined();
    expect(mimeOf('a.xyz')).toBeUndefined();
  });
});

describe('officeFormat', () => {
  it('sends Word and Excel to the in-app viewers', () => {
    expect(officeFormat('Tờ trình.DOCX')).toBe('docx');
    expect(officeFormat('bang.xlsx')).toBe('sheet');
    expect(officeFormat('bang.xls')).toBe('sheet');
    expect(officeFormat('du-lieu.csv')).toBe('sheet');
  });

  it('leaves PowerPoint, old .doc and anything else to another app', () => {
    expect(officeFormat('bao-cao.pptx')).toBeUndefined();
    expect(officeFormat('bao-cao.ppt')).toBeUndefined();
    expect(officeFormat('cong-van.doc')).toBeUndefined();
    expect(officeFormat('ho-so.zip')).toBeUndefined();
  });
});
