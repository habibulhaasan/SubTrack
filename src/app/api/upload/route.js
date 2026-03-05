// src/app/api/upload/route.js

import { NextResponse } from 'next/server';
import { uploadToDrive } from '@/lib/googleDrive';

export const config = { api: { bodyParser: false } };
// Allow up to 50 MB uploads
export const maxDuration = 60;

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file     = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const mimeType = file.type || 'application/octet-stream';
    const fileName = file.name || `upload-${Date.now()}`;

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 50 MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadToDrive(buffer, fileName, mimeType);

    return NextResponse.json(result);
  } catch (err) {
    console.error('[upload]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}