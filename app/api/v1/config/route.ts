import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Return the Temporal connection configuration
    return NextResponse.json({
      temporalHostPort: process.env.TEMPORAL_HOST_PORT || 'localhost:7233',
      temporalNamespace: process.env.TEMPORAL_NAMESPACE || 'default',
    });
  } catch (error) {
    console.error('Error in config API:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve configuration' },
      { status: 500 }
    );
  }
}