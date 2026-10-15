' Hides the console. Waits so the scheduled task stays alive while uvicorn runs.
Set shell = CreateObject("Wscript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
bat = fso.GetParentFolderName(WScript.ScriptFullName) & "\start-controller.bat"
shell.CurrentDirectory = fso.GetParentFolderName(bat)
shell.Run "cmd.exe /c """ & bat & """", 0, True
