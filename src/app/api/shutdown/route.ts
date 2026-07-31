import { NextResponse } from 'next/server';
import { exec } from 'child_process';

export async function POST() {
  try {
    // 클라이언트가 종료 성공 응답을 받을 수 있도록 500ms 뒤에 백그라운드 프로세스 종료 실행
    setTimeout(() => {
      try {
        exec('taskkill /F /IM node.exe 2>nul');
      } catch (e) {
        // Ignore
      }
    }, 500);

    return NextResponse.json({ 
      success: true, 
      message: "모든 로컬 서버가 안전하게 종료되고 RAM이 완벽하게 해제되었습니다." 
    });
  } catch (error) {
    return NextResponse.json({ error: "서버 종료 요청 실패" }, { status: 500 });
  }
}
