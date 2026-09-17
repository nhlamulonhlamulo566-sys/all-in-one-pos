import { NextResponse } from 'next/server';
import { redeemActivationTokenAction } from '@/app/actions/shop-actions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body.token === 'string' ? body.token : '';
    const hardwareId = typeof body.hardwareId === 'string' ? body.hardwareId : '';

    if (!token.trim() || !hardwareId.trim()) {
      return NextResponse.json(
        { success: false, message: 'Activation token and hardware ID are required.' },
        { status: 400 }
      );
    }

    const result = await redeemActivationTokenAction({ token, hardwareId });
    if ('error' in result) {
      return NextResponse.json(
        { success: false, message: result.error },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        shopId: result.shopId,
        shopName: result.shopName,
        maxDevicesAllowed: result.maxDevicesAllowed,
        terminalToken: result.terminalToken,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: 'Unable to process activation request.' },
      { status: 400 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, message: 'Activation requires a POST request.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}
