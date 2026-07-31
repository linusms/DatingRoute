Set WshShell = CreateObject("WScript.Shell")
strDesktop = WshShell.SpecialFolders("Desktop")

' 1. 데이트앱_실행 바로가기 생성
Set oShellLink1 = WshShell.CreateShortcut(strDesktop & "\데이트앱_실행.lnk")
oShellLink1.TargetPath = "c:\Users\MINSEOK\Documents\antigravity\dateapp\start_server.bat"
oShellLink1.WorkingDirectory = "c:\Users\MINSEOK\Documents\antigravity\dateapp"
oShellLink1.Description = "데이트 로드맵 앱 로컬 서버 바로 실행하기 (RAM 자동청소 포함)"
oShellLink1.IconLocation = "shell32.dll, 13"
oShellLink1.Save

' 2. 데이트앱_종료 바로가기 생성
Set oShellLink2 = WshShell.CreateShortcut(strDesktop & "\데이트앱_종료.lnk")
oShellLink2.TargetPath = "c:\Users\MINSEOK\Documents\antigravity\dateapp\서버_종료.bat"
oShellLink2.WorkingDirectory = "c:\Users\MINSEOK\Documents\antigravity\dateapp"
oShellLink2.Description = "데이트 로드맵 앱 서버 종료 및 메모리(RAM) 즉시 반환"
oShellLink2.IconLocation = "shell32.dll, 27"
oShellLink2.Save

MsgBox "바탕화면에 '데이트앱_실행'과 '데이트앱_종료' 아이콘 2개가 성공적으로 생성되었습니다!" & vbCrLf & vbCrLf & "🚀 [데이트앱_실행]: 자동으로 이전 좀비 서버를 청소하고 고속 부팅 후 브라우저를 엽니다." & vbCrLf & "🛑 [데이트앱_종료]: 언제든 클릭하면 백그라운드의 모든 서버와 메모리를 100% 깔끔하게 해제합니다!", 64, "데이트 로드맵 - 바로가기 및 메모리 관리자 생성 완료"
