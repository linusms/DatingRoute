Set WshShell = CreateObject("WScript.Shell")
strDesktop = WshShell.SpecialFolders("Desktop")
Set oShellLink = WshShell.CreateShortcut(strDesktop & "\데이트앱_실행.lnk")
oShellLink.TargetPath = "c:\Users\MINSEOK\Documents\antigravity\dateapp\start_server.bat"
oShellLink.WorkingDirectory = "c:\Users\MINSEOK\Documents\antigravity\dateapp"
oShellLink.Description = "데이트 로드맵 앱 로컬 서버 바로 실행하기"
oShellLink.IconLocation = "shell32.dll, 13"
oShellLink.Save
MsgBox "바탕화면에 '데이트앱_실행' 아이콘이 성공적으로 생성되었습니다!" & vbCrLf & vbCrLf & "이제 바탕화면의 아이콘을 더블클릭하면:" & vbCrLf & "1. 로컬 서버가 자동으로 부팅되고" & vbCrLf & "2. 웹 브라우저가 열리면서 데이트 앱이 바로 실행됩니다!", 64, "데이트 로드맵 - 바로가기 생성 완료"
