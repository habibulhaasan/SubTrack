// src/lib/googleDrive.js
// Shared Google Drive client — used by all API routes

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_URL = 'https://www.googleapis.com/drive/v3';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';

let _cachedToken = null;
let _tokenExpiry = 0;

/** Exchange refresh token for a fresh access token (cached until expiry) */
async function getAccessToken() {
  if (_cachedToken && Date.now() < _tokenExpiry - 60_000) return _cachedToken;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data));

  _cachedToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return _cachedToken;
}

/**
 * Upload a file to Google Drive.
 * Returns { fileId, mimeType, size, viewUrl, thumbUrl }
 */
export async function uploadToDrive(buffer, fileName, mimeType) {
  const token    = await getAccessToken();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;

  // Metadata
  const metadata = { name: fileName, mimeType };
  if (folderId) metadata.parents = [folderId];

  // Multipart upload
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metaPart =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata);

  const bodyPart =
    '\r\n--' + boundary + '\r\n' +
    `Content-Type: ${mimeType}\r\n\r\n`;

  const closing = closeDelim;

  // Combine: text parts + binary buffer + closing
  const metaBytes  = Buffer.from(metaPart, 'utf8');
  const bodyHeader = Buffer.from(bodyPart, 'utf8');
  const closeBytes = Buffer.from(closing,  'utf8');
  const combined   = Buffer.concat([metaBytes, bodyHeader, buffer, closeBytes]);

  const uploadRes = await fetch(
    `${UPLOAD_URL}/files?uploadType=multipart&fields=id,mimeType,size,webViewLink,thumbnailLink`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
        'Content-Length': combined.length,
      },
      body: combined,
    }
  );

  const file = await uploadRes.json();
  if (!file.id) throw new Error('Drive upload failed: ' + JSON.stringify(file));

  // Make file publicly readable so members can view/download
  await fetch(`${DRIVE_URL}/files/${file.id}/permissions`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  // Re-fetch to get updated links
  const infoRes = await fetch(
    `${DRIVE_URL}/files/${file.id}?fields=id,mimeType,size,webContentLink,webViewLink,thumbnailLink`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const info = await infoRes.json();

  // Build the best view/download URL
  const viewUrl =
    info.webContentLink ||                                               // direct download
    `https://drive.google.com/uc?export=download&id=${file.id}`;       // fallback

  // Thumbnail: Drive provides one for images & PDFs
  const thumbUrl = info.thumbnailLink
    ? info.thumbnailLink.replace(/=s\d+/, '=s400')                      // get bigger thumb
    : null;

  return {
    fileId:   file.id,
    mimeType: info.mimeType || mimeType,
    size:     parseInt(info.size || buffer.length),
    viewUrl,
    thumbUrl,
  };
}

/**
 * Delete a file from Google Drive by fileId
 */
export async function deleteFromDrive(fileId) {
  const token = await getAccessToken();
  await fetch(`${DRIVE_URL}/files/${fileId}`, {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}