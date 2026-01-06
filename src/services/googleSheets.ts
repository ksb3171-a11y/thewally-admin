import type { B2BContact } from '../types/b2b';
import { getAllContacts, bulkAddContacts, addCustomCategory, getAllCategories } from './b2bStorage';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const SHEET_NAME = '이메일데이타V1.0';

interface SheetFile {
  id: string;
  name: string;
}

// 구글 드라이브에서 시트 파일 찾기
const findSheetFile = async (accessToken: string): Promise<SheetFile | null> => {
  // 한글 파일명을 URL 인코딩
  const query = encodeURIComponent(`name='${SHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
  const response = await fetch(
    `${DRIVE_API_BASE}/files?q=${query}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Drive API Error:', errorData);
    throw new Error(`시트 파일을 찾는데 실패했습니다. (${response.status}: ${errorData.error?.message || response.statusText})`);
  }

  const data = await response.json();
  console.log('Found sheets:', data.files);
  return data.files && data.files.length > 0 ? data.files[0] : null;
};

// 구글 시트에서 데이터 읽기
const readSheetData = async (accessToken: string, spreadsheetId: string): Promise<string[][]> => {
  // 첫 번째 시트의 A:C 범위 (단체명, 이메일, 분류)
  const range = 'A:C';
  const response = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Sheets API Error:', errorData);
    throw new Error(`시트 데이터를 읽는데 실패했습니다. (${response.status}: ${errorData.error?.message || response.statusText})`);
  }

  const data = await response.json();
  console.log('Sheet data rows:', data.values?.length || 0);
  return data.values || [];
};

// 시트 데이터를 연락처 형식으로 변환
const parseSheetData = (rows: string[][]): Omit<B2BContact, 'id' | 'collectedAt'>[] => {
  if (rows.length < 2) return []; // 헤더만 있거나 데이터가 없는 경우

  const contacts: Omit<B2BContact, 'id' | 'collectedAt'>[] = [];

  // 첫 번째 줄은 헤더로 건너뜀
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;

    const name = row[0]?.trim();
    const email = row[1]?.trim();
    const category = row[2]?.trim() || '지정안됨'; // C열이 분류, 없으면 "지정안됨"

    // 이름과 이메일이 있고, 이메일 형식이 맞는지 확인
    if (!name || !email || !email.includes('@')) continue;

    contacts.push({
      name,
      email,
      category,
      phone: undefined,
      address: undefined,
      seasonTags: [],
      memo: undefined,
    });
  }

  return contacts;
};

// 중복 체크 후 새 연락처만 필터링
const filterNewContacts = (
  sheetContacts: Omit<B2BContact, 'id' | 'collectedAt'>[],
  existingContacts: B2BContact[]
): Omit<B2BContact, 'id' | 'collectedAt'>[] => {
  const existingEmails = new Set(existingContacts.map((c) => c.email.toLowerCase()));

  return sheetContacts.filter((contact) => !existingEmails.has(contact.email.toLowerCase()));
};

// 새로운 분류가 있으면 추가
const ensureCategories = (contacts: Omit<B2BContact, 'id' | 'collectedAt'>[]): void => {
  const existingCategories = new Set(getAllCategories());
  const newCategories = new Set<string>();

  contacts.forEach((contact) => {
    if (!existingCategories.has(contact.category)) {
      newCategories.add(contact.category);
    }
  });

  // 새로운 분류 추가
  newCategories.forEach((category) => {
    addCustomCategory(category);
  });
};

export interface SyncResult {
  success: boolean;
  totalInSheet: number;
  newContactsAdded: number;
  skippedDuplicates: number;
  newCategories: string[];
  error?: string;
}

// 구글 시트에서 데이터 동기화
export const syncFromGoogleSheet = async (accessToken: string): Promise<SyncResult> => {
  try {
    // 1. 시트 파일 찾기
    const sheetFile = await findSheetFile(accessToken);
    if (!sheetFile) {
      return {
        success: false,
        totalInSheet: 0,
        newContactsAdded: 0,
        skippedDuplicates: 0,
        newCategories: [],
        error: `"${SHEET_NAME}" 시트를 찾을 수 없습니다. 구글 드라이브에서 시트 이름을 확인해주세요.`,
      };
    }

    // 2. 시트 데이터 읽기
    const rows = await readSheetData(accessToken, sheetFile.id);
    const sheetContacts = parseSheetData(rows);

    if (sheetContacts.length === 0) {
      return {
        success: true,
        totalInSheet: 0,
        newContactsAdded: 0,
        skippedDuplicates: 0,
        newCategories: [],
        error: '시트에 유효한 데이터가 없습니다.',
      };
    }

    // 3. 기존 연락처 가져오기
    const existingContacts = getAllContacts();

    // 4. 새 연락처만 필터링
    const newContacts = filterNewContacts(sheetContacts, existingContacts);

    // 5. 새로운 분류 추가
    const existingCategories = new Set(getAllCategories());
    const newCategories: string[] = [];
    newContacts.forEach((contact) => {
      if (!existingCategories.has(contact.category) && !newCategories.includes(contact.category)) {
        newCategories.push(contact.category);
      }
    });
    ensureCategories(newContacts);

    // 6. 새 연락처 저장
    if (newContacts.length > 0) {
      bulkAddContacts(newContacts);
    }

    return {
      success: true,
      totalInSheet: sheetContacts.length,
      newContactsAdded: newContacts.length,
      skippedDuplicates: sheetContacts.length - newContacts.length,
      newCategories,
    };
  } catch (error) {
    return {
      success: false,
      totalInSheet: 0,
      newContactsAdded: 0,
      skippedDuplicates: 0,
      newCategories: [],
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
    };
  }
};
