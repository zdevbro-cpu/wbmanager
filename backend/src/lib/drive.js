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
  });

  return {
    driveFileId: res.data.id,
    fileName: res.data.name,
    webViewLink: res.data.webViewLink,
  };
}
