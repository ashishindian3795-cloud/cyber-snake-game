@echo off
set "PATH=%PATH%;C:\Users\ASUS\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd;C:\Program Files\GitHub CLI"
git config user.name "Coder"
git config user.email "coder@openmausbot.local"
git branch -M main
git add -A
git commit -m "Initial commit: Neon Cyber Snake Arcade Game"
git log -n 1
