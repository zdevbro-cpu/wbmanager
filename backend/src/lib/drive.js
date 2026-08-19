import { google } from 'googleapis';
import { Readable } from 'stream';

let driveClient = null;

function getDriveClient() {
  if (driveClient) return driveClient;

  const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI, GOOGLE_OAUTH_REFRESH_TOKEN } =
    process.env;

  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REFRESH_TOKEN) {
    throw new Error(
      'Drive OAuth 설정이 없습니다. GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN을 설정하세요. (scripts/get-refresh-token.mjs 참고)',
    );
  }

  const oauth2Client = new google.auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI);
  oauth2Client.setCredentials({ refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN });

  driveClient = google.drive({ version: 'v3', auth: oauth2Client });
  return driveClient;
}

// 계량증명서/현장사진 등 증빙 파일을 지정된 드라이브 폴더에 업로드하고
// { driveFileId, fileName, webViewLink }를 반환한다.
export async function uploadToDrive({ buffer, fileName, mimeType }) {
  const drive = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id, name, webViewLink',
    // 공유 드라이브로 옮겨도 코드를 고치지 않도록 지금부터 켜 둔다. 개인 드라이브에서는 무해하다.
    supportsAllDrives: true,
  });

  return {
    driveFileId: res.data.id,
    fileName: res.data.name,
    webViewLink: res.data.webViewLink,
  };
}

// DMS 열람·다운로드는 앱을 거친다 — 드라이브 링크를 화면에 노출하지 않기 위해서다.
// 설계 근거: docs/dms-design.md 1장 원칙 2.
export async function downloadFromDrive(fileId) {
  const drive = getDriveClient();
  const meta = await drive.files.get({
    fileId,
    fields: 'name, mimeType, size',
    supportsAllDrives: true,
  });
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' },
  );
  return { stream: res.data, ...meta.data };
}
