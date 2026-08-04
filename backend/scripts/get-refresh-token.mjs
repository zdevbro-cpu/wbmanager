// 최초 1회 실행: Google OAuth 동의 후 refresh token을 발급받아 .env에 넣을 값을 출력한다.
// 사용법: GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... node scripts/get-refresh-token.mjs
import 'dotenv/config';
import http from 'node:http';
import { google } from 'googleapis';

const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } = process.env;

if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
  console.error('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET을 .env에 먼저 설정하세요.');
  process.exit(1);
}

const redirectUri = GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:8081';
const { hostname, port, pathname } = new URL(redirectUri);

const oauth2Client = new google.auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, redirectUri);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive'],
});

console.log('\n아래 URL을 브라우저에서 열고, 파일을 업로드할 구글 계정으로 로그인/동의하세요:\n');
console.log(authUrl, '\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${hostname}:${port}`);
  if (url.pathname !== pathname) {
    res.writeHead(404);
    res.end();
    return;
  }

  const code = url.searchParams.get('code');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>인증 완료. 이 창을 닫고 터미널을 확인하세요.</h1>');

  const { tokens } = await oauth2Client.getToken(code);
  console.log('\n발급된 refresh_token (backend/.env의 GOOGLE_OAUTH_REFRESH_TOKEN에 넣으세요):\n');
  console.log(tokens.refresh_token, '\n');

  server.close();
  process.exit(0);
});

server.listen(Number(port), () => {
  console.log(`콜백 대기 중: ${redirectUri}`);
});
