' Desliga o Routine Tracker com segurança (banco primeiro, depois o servidor). Basta dar dois cliques.
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\scripts\desligar.ps1""", 0, False
