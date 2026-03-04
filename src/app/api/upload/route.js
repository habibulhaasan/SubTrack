// src/app/api/upload/route.js
import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';
import path from 'path';

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

function getAuth() {
  return new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'service-account.json'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file     = formData.get('file');

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const auth  = getAuth();
    const drive = google.drive({ version: 'v3', auth });

    const uploaded = await drive.files.create({
      requestBody: {
        name:    file.name,
        parents: [FOLDER_ID],
      },
      media: {
        mimeType: file.type || 'application/octet-stream',
        body:     Readable.from(buffer),
      },
      fields: 'id, name, mimeType, size',
    });

    const fileId = uploaded.data.id;

    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    const isImage  = (file.type || '').startsWith('image/');
    const viewUrl  = isImage
      ? `https://drive.google.com/uc?export=view&id=${fileId}`
      : `https://drive.google.com/file/d/${fileId}/view`;
    const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;

    return NextResponse.json({
      fileId,
      name:     uploaded.data.name,
      mimeType: uploaded.data.mimeType,
      size:     buffer.length,
      viewUrl,
      thumbUrl,
    });

  } catch (err) {
    console.error('Drive upload error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}