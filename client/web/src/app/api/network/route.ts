import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSlot, getServiceInfo } from '@/app/actions/jam';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const serviceId = request.nextUrl.searchParams.get('serviceId');

    const slotResult = await getCurrentSlot();

    let serviceInfo = null;
    if (serviceId) {
      serviceInfo = await getServiceInfo(serviceId);
    }

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
