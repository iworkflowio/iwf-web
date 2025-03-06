import { NextRequest, NextResponse } from 'next/server';
import { temporalConfig } from '../workflow/utils';

export async function GET(request: NextRequest) {
  // Return the configuration for client-side use
  return NextResponse.json(temporalConfig, { status: 200 });
}
