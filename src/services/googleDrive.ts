import type { BudgetData } from '../types';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_NAME = 'BudgetApp';
const FILE_NAME = 'budget-data.json';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

const getOrCreateFolder = async (accessToken: string): Promise<string> => {
  const searchResponse = await fetch(
    `${DRIVE_API_BASE}/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!searchResponse.ok) throw new Error('Failed to search for folder');

  const searchData = await searchResponse.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createResponse = await fetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createResponse.ok) throw new Error('Failed to create folder');

  const createData = await createResponse.json();
  return createData.id;
};

const findFile = async (accessToken: string, folderId: string): Promise<DriveFile | null> => {
  const response = await fetch(
    `${DRIVE_API_BASE}/files?q=name='${FILE_NAME}' and '${folderId}' in parents and trashed=false&fields=files(id,name,mimeType,modifiedTime)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) throw new Error('Failed to search for file');

  const data = await response.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
};

export const readFromDrive = async (accessToken: string): Promise<BudgetData | null> => {
  try {
    const folderId = await getOrCreateFolder(accessToken);
    const file = await findFile(accessToken, folderId);

    if (!file) return null;

    const response = await fetch(`${DRIVE_API_BASE}/files/${file.id}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error('Failed to read file');

    return await response.json();
  } catch (error) {
    console.error('Error reading from Drive:', error);
    return null;
  }
};

export const saveToDrive = async (accessToken: string, data: BudgetData): Promise<boolean> => {
  try {
    const folderId = await getOrCreateFolder(accessToken);
    const existingFile = await findFile(accessToken, folderId);

    const metadata = {
      name: FILE_NAME,
      mimeType: 'application/json',
      parents: existingFile ? undefined : [folderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(data)], { type: 'application/json' }));

    const url = existingFile
      ? `${DRIVE_UPLOAD_BASE}/files/${existingFile.id}?uploadType=multipart`
      : `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`;

    const response = await fetch(url, {
      method: existingFile ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });

    return response.ok;
  } catch (error) {
    console.error('Error saving to Drive:', error);
    return false;
  }
};

export const getDriveFileModifiedTime = async (accessToken: string): Promise<string | null> => {
  try {
    const folderId = await getOrCreateFolder(accessToken);
    const file = await findFile(accessToken, folderId);
    return file?.modifiedTime || null;
  } catch {
    return null;
  }
};
