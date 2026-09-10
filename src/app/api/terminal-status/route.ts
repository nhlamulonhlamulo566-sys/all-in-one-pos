import { NextResponse } from 'next/server';
import { heartbeatTerminalAction } from '@/app/actions/shop-actions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body?.shopId !== 'string' || typeof body?.hardwareId !== 'string' || typeof body?.terminalToken !== 'string') {
      return NextResponse.json({ success: false, error: 'Terminal identity is incomplete.' }, { status: 400 });
    }
    const result = await heartbeatTerminalAction({
      shopId: body.shopId,
      hardwareId: body.hardwareId,
      terminalToken: body.terminalToken,
    });
    return NextResponse.json(result, { status: result.success ? 200 : 403 });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to check terminal status.' }, { status: 503 });
  }
}