import { NextResponse } from 'next/server';
import { getCurrentSlot, getServiceInfo } from '@/app/actions/jam';

const SERVICE_ID = process.env.NEXT_PUBLIC_JAM_SERVICE_ID || '99fbfec5';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const [slotResult, serviceInfo] = await Promise.all([
      getCurrentSlot(),
      getServiceInfo(SERVICE_ID),
    ]);

    return NextResponse.json({
      currentSlot: slotResult.slot,
      serviceInfo,
      timestamp: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch network data' },
      { status: 500 }
    );
  }
}
