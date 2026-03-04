// src/app/api/files/delete/route.js
import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import path from 'path';

function getAuth() {
  return new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'service-account.json'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

export async function DELETE(request) {
  try {
    const { fileId } = await request.json();
    if (!fileId) return NextResponse.json({ error: 'No fileId provided' }, { status: 400 });

    const auth  = getAuth();
    const drive = google.drive({ version: 'v3', auth });
    await drive.files.delete({ fileId });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Drive delete error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}